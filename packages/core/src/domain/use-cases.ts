import { DomainDomainError, DomainHostnameConflictError } from "./errors";
import type { DomainChallengeHasher, DomainTokenGenerator, DomainVerifier } from "./ports";
import type { DomainRepository } from "../identity/ports";
import { normalizeHostname, normalizeRequiredId } from "../identity/rules";
import type { DomainRecord } from "../identity/types";
import type { Clock } from "../identity/ports";

export interface CreateDomainInput {
  userId: string;
  hostname: string;
}

export interface DomainProvisioningResult {
  domain: DomainRecord;
  verificationToken: string;
}

export interface DomainUseCaseDependencies {
  domainRepository: DomainManagementRepository;
  challengeHasher: DomainChallengeHasher;
  tokenGenerator: DomainTokenGenerator;
  verifier: DomainVerifier;
  clock?: Clock;
}

export interface DomainManagementRepository extends DomainRepository {
  findByHostname(hostname: string): Promise<DomainRecord | null>;
  create(domain: DomainRecord): Promise<DomainRecord>;
  update(domain: DomainRecord): Promise<DomainRecord>;
}

const systemClock: Clock = {
  now: () => new Date(),
};

function normalizeDomainHostname(value: string): string {
  try {
    return normalizeHostname(value);
  } catch {
    throw new DomainDomainError("invalid_input", "The domain hostname is invalid.");
  }
}

function normalizeVerificationToken(value: string): string {
  if (typeof value !== "string" || value.trim().length < 16 || value.length > 512) {
    throw new DomainDomainError("invalid_input", "The domain verification token is invalid.");
  }

  return value.trim();
}

export class DomainUseCases {
  private readonly clock: Clock;

  constructor(private readonly dependencies: DomainUseCaseDependencies) {
    this.clock = dependencies.clock ?? systemClock;
  }

  async createDomain(input: CreateDomainInput): Promise<DomainProvisioningResult> {
    if (!input) {
      throw new DomainDomainError("invalid_input", "The domain request is invalid.");
    }

    const userId = normalizeRequiredId(input.userId, "userId");
    const hostname = normalizeDomainHostname(input.hostname);

    if (await this.dependencies.domainRepository.findByHostname(hostname)) {
      throw new DomainHostnameConflictError();
    }

    const verificationToken = this.dependencies.tokenGenerator.generate();
    const now = this.clock.now();
    const domain: DomainRecord = {
      id: crypto.randomUUID(),
      userId,
      hostname,
      status: "pending",
      verificationTokenHash: await this.dependencies.challengeHasher.hash(verificationToken),
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.dependencies.domainRepository.create(domain);
    return { domain: created, verificationToken };
  }

  listDomains(userId: string): Promise<DomainRecord[]> {
    return this.dependencies.domainRepository.listByUserId(normalizeRequiredId(userId, "userId"));
  }

  async rotateVerificationToken(
    userId: string,
    domainId: string,
  ): Promise<DomainProvisioningResult> {
    const domain = await this.getOwnedDomain(userId, domainId);

    if (domain.status !== "pending") {
      throw new DomainDomainError(
        "invalid_lifecycle_transition",
        "Only a pending domain can receive a new verification token.",
      );
    }

    const verificationToken = this.dependencies.tokenGenerator.generate();
    const updated = await this.dependencies.domainRepository.update({
      ...domain,
      verificationTokenHash: await this.dependencies.challengeHasher.hash(verificationToken),
      updatedAt: this.clock.now(),
    });

    return { domain: updated, verificationToken };
  }

  async verifyDomain(userId: string, domainId: string, token: string): Promise<DomainRecord> {
    const domain = await this.getOwnedDomain(userId, domainId);

    if (domain.status === "verified") return domain;
    if (domain.status === "revoked") {
      throw new DomainDomainError(
        "invalid_lifecycle_transition",
        "A revoked domain cannot be verified.",
      );
    }

    const verificationToken = normalizeVerificationToken(token);
    const tokenHash = domain.verificationTokenHash;
    let tokenMatches = false;
    try {
      tokenMatches = tokenHash
        ? await this.dependencies.challengeHasher.verify(verificationToken, tokenHash)
        : false;
    } catch {
      tokenMatches = false;
    }

    if (!tokenMatches) {
      throw new DomainDomainError(
        "domain_verification_failed",
        "The domain verification challenge is invalid.",
      );
    }

    const check = await this.dependencies.verifier.verify(domain.hostname, verificationToken);
    if (check === "unavailable") {
      throw new DomainDomainError(
        "domain_verification_unavailable",
        "Domain verification is temporarily unavailable.",
      );
    }
    if (check !== "verified") {
      throw new DomainDomainError(
        "domain_verification_failed",
        "The domain verification record was not found.",
      );
    }

    const now = this.clock.now();

    return this.dependencies.domainRepository.update({
      ...domain,
      status: "verified",
      verificationTokenHash: null,
      verifiedAt: now,
      updatedAt: now,
    });
  }

  private async getOwnedDomain(userId: string, domainId: string): Promise<DomainRecord> {
    const ownerId = normalizeRequiredId(userId, "userId");
    const id = normalizeRequiredId(domainId, "domainId");
    const domain = await this.dependencies.domainRepository.findById(id);

    if (!domain || domain.userId !== ownerId) {
      throw new DomainDomainError("domain_not_found", "The requested domain was not found.");
    }

    return domain;
  }
}
