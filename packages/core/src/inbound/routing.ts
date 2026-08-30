import { hasExpired, normalizeAddress } from "../identity/rules";
import type { Clock, DomainRepository, IdentityRepository } from "../identity/ports";
import type { IdentityRecord } from "../identity/types";
import { getEligibleDestinations } from "../destination/routing";
import type { DestinationRepository, IdentityDestinationRepository } from "../destination/ports";
import type { DestinationRecord } from "../destination/types";

export type InboundRoutingRejectionReason =
  | "invalid_recipient"
  | "identity_not_found"
  | "domain_not_found"
  | "domain_not_usable"
  | "identity_expired"
  | "identity_torched"
  | "no_destinations";

export interface InboundRoutingInput {
  readonly recipient: string;
}

export type InboundRoutingDecision =
  | {
      readonly accepted: false;
      readonly reason: InboundRoutingRejectionReason;
    }
  | {
      readonly accepted: true;
      readonly identity: IdentityRecord;
      readonly destinations: DestinationRecord[];
    };

export interface InboundRoutingDependencies {
  readonly domainRepository: DomainRepository;
  readonly identityRepository: IdentityRepository;
  readonly destinationRepository: DestinationRepository;
  readonly identityDestinationRepository: IdentityDestinationRepository;
  readonly clock?: Clock;
}

const systemClock: Clock = {
  now: () => new Date(),
};

/**
 * Resolves an inbound recipient into an authorization-safe routing decision.
 * Rejection reasons are for internal orchestration and must not be exposed to
 * an unauthenticated sender as separate externally observable responses.
 */
export class InboundRoutingUseCases {
  private readonly clock: Clock;

  constructor(private readonly dependencies: InboundRoutingDependencies) {
    this.clock = dependencies.clock ?? systemClock;
  }

  async route(input: InboundRoutingInput): Promise<InboundRoutingDecision> {
    if (typeof input.recipient !== "string") {
      return { accepted: false, reason: "invalid_recipient" };
    }

    let recipient: string;

    try {
      recipient = normalizeAddress(input.recipient);
    } catch {
      return { accepted: false, reason: "invalid_recipient" };
    }

    const identity = await this.dependencies.identityRepository.findByAddress(recipient);

    if (!identity) {
      return { accepted: false, reason: "identity_not_found" };
    }

    if (identity.status === "torched") {
      return { accepted: false, reason: "identity_torched" };
    }

    const now = this.clock.now();

    if (identity.status === "expired" || hasExpired(identity, now)) {
      return { accepted: false, reason: "identity_expired" };
    }

    const domain = await this.dependencies.domainRepository.findById(identity.domainId);

    if (!domain) {
      return { accepted: false, reason: "domain_not_found" };
    }

    if (domain.userId !== identity.userId || domain.status !== "verified") {
      return { accepted: false, reason: "domain_not_usable" };
    }

    if (identity.status !== "active") {
      return { accepted: false, reason: "identity_expired" };
    }

    const [routes, destinations] = await Promise.all([
      this.dependencies.identityDestinationRepository.listByIdentityId(identity.id),
      this.dependencies.destinationRepository.listByUserId(identity.userId),
    ]);
    const eligibleDestinations = getEligibleDestinations(identity, routes, destinations, now);

    if (eligibleDestinations.length === 0) {
      return { accepted: false, reason: "no_destinations" };
    }

    return {
      accepted: true,
      identity,
      destinations: eligibleDestinations,
    };
  }
}
