import { DestinationDomainError } from "./errors";
import type { DestinationRepository, IdentityDestinationRepository } from "./ports";
import type { DestinationRecord, IdentityDestinationRecord } from "./types";
import type { IdentityRepository } from "../identity/ports";

export interface UpdateDestinationInput {
  enabled: boolean;
}

export interface DestinationUseCaseDependencies {
  destinationRepository: DestinationRepository;
  identityDestinationRepository: IdentityDestinationRepository;
  identityRepository: IdentityRepository;
  clock?: { now(): Date };
}

export interface IdentityDestinationOption {
  destination: DestinationRecord;
  selected: boolean;
}

const systemClock = { now: () => new Date() };

function requiredId(value: string, field: string): string {
  const id = value.trim();

  if (!id) {
    throw new DestinationDomainError("invalid_input", `${field} is required.`);
  }

  return id;
}

export class DestinationUseCases {
  private readonly clock: { now(): Date };

  constructor(private readonly dependencies: DestinationUseCaseDependencies) {
    this.clock = dependencies.clock ?? systemClock;
  }

  listDestinations(userId: string): Promise<DestinationRecord[]> {
    return this.dependencies.destinationRepository.listByUserId(requiredId(userId, "userId"));
  }

  async updateDestination(
    userId: string,
    destinationId: string,
    input: UpdateDestinationInput,
  ): Promise<DestinationRecord> {
    const ownerId = requiredId(userId, "userId");
    const id = requiredId(destinationId, "destinationId");
    const destination = await this.getOwnedDestination(ownerId, id);

    if (typeof input.enabled !== "boolean") {
      throw new DestinationDomainError("invalid_input", "Destination enabled state is invalid.");
    }

    return this.dependencies.destinationRepository.update({
      ...destination,
      enabled: input.enabled,
      updatedAt: this.clock.now(),
    });
  }

  async listIdentityDestinations(
    userId: string,
    identityId: string,
  ): Promise<IdentityDestinationOption[]> {
    const ownerId = requiredId(userId, "userId");
    const identity = await this.getOwnedIdentity(ownerId, identityId);
    const [destinations, routes] = await Promise.all([
      this.dependencies.destinationRepository.listByUserId(ownerId),
      this.dependencies.identityDestinationRepository.listByIdentityId(identity.id),
    ]);
    const selectedDestinationIds = new Set(routes.map((route) => route.destinationId));

    return destinations.map((destination) => ({
      destination,
      selected: selectedDestinationIds.has(destination.id),
    }));
  }

  async addIdentityDestination(
    userId: string,
    identityId: string,
    destinationId: string,
  ): Promise<IdentityDestinationRecord> {
    const ownerId = requiredId(userId, "userId");
    const identity = await this.getMutableIdentity(ownerId, identityId);
    const destination = await this.getOwnedDestination(ownerId, destinationId);
    const routes = await this.dependencies.identityDestinationRepository.listByIdentityId(
      identity.id,
    );
    const existing = routes.find((route) => route.destinationId === destination.id);

    if (existing) return existing;

    return this.dependencies.identityDestinationRepository.add({
      identityId: identity.id,
      destinationId: destination.id,
      createdAt: this.clock.now(),
    });
  }

  async removeIdentityDestination(
    userId: string,
    identityId: string,
    destinationId: string,
  ): Promise<void> {
    const ownerId = requiredId(userId, "userId");
    const identity = await this.getMutableIdentity(ownerId, identityId);
    const destination = await this.getOwnedDestination(ownerId, destinationId);

    await this.dependencies.identityDestinationRepository.remove(identity.id, destination.id);
  }

  private async getOwnedDestination(userId: string, destinationId: string) {
    const destination = await this.dependencies.destinationRepository.findById(destinationId);

    if (!destination || destination.userId !== userId) {
      throw new DestinationDomainError(
        "destination_not_found",
        "The requested destination was not found.",
      );
    }

    return destination;
  }

  private async getOwnedIdentity(userId: string, identityId: string) {
    const identity = await this.dependencies.identityRepository.findById(
      requiredId(identityId, "identityId"),
    );

    if (!identity || identity.userId !== userId) {
      throw new DestinationDomainError(
        "identity_not_found",
        "The requested identity was not found.",
      );
    }

    return identity;
  }

  private async getMutableIdentity(userId: string, identityId: string) {
    const identity = await this.getOwnedIdentity(userId, identityId);

    if (
      identity.status !== "active" ||
      (identity.expiresAt !== null && identity.expiresAt <= this.clock.now())
    ) {
      throw new DestinationDomainError(
        "invalid_lifecycle_transition",
        "Only an active identity can change its destinations.",
      );
    }

    return identity;
  }
}
