import { IdentityAddressConflictError, IdentityDomainError } from "./errors";
import type {
  Clock,
  DomainRepository,
  IdGenerator,
  IdentityRepository,
  LocalPartGenerator,
} from "./ports";
import {
  hasExpired,
  normalizeAddress,
  normalizeExpiration,
  normalizeHostname,
  normalizeLabel,
  normalizeLocalPart,
  normalizeRequiredId,
} from "./rules";
import type { CreateIdentityInput, IdentityRecord, UpdateIdentityInput } from "./types";

const MAX_ADDRESS_ALLOCATION_ATTEMPTS = 5;

const systemClock: Clock = {
  now: () => new Date(),
};

const randomIdGenerator: IdGenerator = {
  generate: () => crypto.randomUUID(),
};

const localPartAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

const secureLocalPartGenerator: LocalPartGenerator = {
  generate: () => {
    const result: string[] = [];
    const maxUnbiasedByte = 256 - (256 % localPartAlphabet.length);

    while (result.length < 10) {
      const bytes = new Uint8Array(10);
      crypto.getRandomValues(bytes);

      for (const byte of bytes) {
        if (byte >= maxUnbiasedByte) {
          continue;
        }

        result.push(localPartAlphabet[byte % localPartAlphabet.length] as string);

        if (result.length === 10) {
          break;
        }
      }
    }

    return result.join("");
  },
};

export interface IdentityUseCaseDependencies {
  domainRepository: DomainRepository;
  identityRepository: IdentityRepository;
  clock?: Clock;
  idGenerator?: IdGenerator;
  localPartGenerator?: LocalPartGenerator;
}

export class IdentityUseCases {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly localPartGenerator: LocalPartGenerator;

  constructor(private readonly dependencies: IdentityUseCaseDependencies) {
    this.clock = dependencies.clock ?? systemClock;
    this.idGenerator = dependencies.idGenerator ?? randomIdGenerator;
    this.localPartGenerator = dependencies.localPartGenerator ?? secureLocalPartGenerator;
  }

  async createIdentity(input: CreateIdentityInput): Promise<IdentityRecord> {
    const userId = normalizeRequiredId(input.userId, "userId");
    const domainId = normalizeRequiredId(input.domainId, "domainId");
    const label = normalizeLabel(input.label);
    const now = this.clock.now();
    const expiresAt = normalizeExpiration(input.expiresAt, now);
    const domain = await this.dependencies.domainRepository.findById(domainId);

    if (!domain) {
      throw new IdentityDomainError("domain_not_found", "The requested domain was not found.");
    }

    if (domain.userId !== userId || domain.status !== "verified") {
      throw new IdentityDomainError("domain_not_usable", "The requested domain cannot be used.");
    }

    const hostname = normalizeHostname(domain.hostname);

    for (let attempt = 0; attempt < MAX_ADDRESS_ALLOCATION_ATTEMPTS; attempt += 1) {
      const localPart = normalizeLocalPart(this.localPartGenerator.generate());
      const address = normalizeAddress(`${localPart}@${hostname}`);

      if (await this.dependencies.identityRepository.findByAddress(address)) {
        continue;
      }

      const identity: IdentityRecord = {
        id: this.idGenerator.generate(),
        userId,
        domainId,
        localPart,
        address,
        label,
        status: "active",
        expiresAt,
        torchedAt: null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };

      try {
        return await this.dependencies.identityRepository.create(identity);
      } catch (error) {
        if (error instanceof IdentityAddressConflictError) {
          continue;
        }

        throw error;
      }
    }

    throw new IdentityAddressConflictError();
  }

  async getIdentity(userId: string, identityId: string): Promise<IdentityRecord> {
    const identity = await this.getOwnedIdentity(userId, identityId);
    return this.materializeExpiration(identity);
  }

  async listIdentities(userId: string): Promise<IdentityRecord[]> {
    const ownerId = normalizeRequiredId(userId, "userId");
    const identities = await this.dependencies.identityRepository.listByUserId(ownerId);

    return Promise.all(identities.map((identity) => this.materializeExpiration(identity)));
  }

  async updateIdentity(
    userId: string,
    identityId: string,
    input: UpdateIdentityInput,
  ): Promise<IdentityRecord> {
    const identity = await this.materializeExpiration(
      await this.getOwnedIdentity(userId, identityId),
    );

    if (identity.status !== "active") {
      throw new IdentityDomainError(
        "invalid_lifecycle_transition",
        "Only an active identity can be updated.",
      );
    }

    if (input.label === undefined && input.expiresAt === undefined) {
      throw new IdentityDomainError("invalid_input", "At least one identity field is required.");
    }

    const now = this.clock.now();

    return this.dependencies.identityRepository.update({
      ...identity,
      label: input.label === undefined ? identity.label : normalizeLabel(input.label),
      expiresAt:
        input.expiresAt === undefined
          ? identity.expiresAt
          : normalizeExpiration(input.expiresAt, now),
      updatedAt: now,
    });
  }

  async expireIdentity(userId: string, identityId: string): Promise<IdentityRecord> {
    const identity = await this.getOwnedIdentity(userId, identityId);

    if (identity.status === "expired") {
      return identity;
    }

    if (identity.status !== "active" || !hasExpired(identity, this.clock.now())) {
      throw new IdentityDomainError(
        "invalid_lifecycle_transition",
        "Only an active identity whose expiration has passed can expire.",
      );
    }

    return this.dependencies.identityRepository.update({
      ...identity,
      status: "expired",
      updatedAt: this.clock.now(),
    });
  }

  async torchIdentity(userId: string, identityId: string): Promise<IdentityRecord> {
    const identity = await this.materializeExpiration(
      await this.getOwnedIdentity(userId, identityId),
    );

    if (identity.status === "torched") {
      throw new IdentityDomainError(
        "invalid_lifecycle_transition",
        "A torched identity cannot be changed.",
      );
    }

    const now = this.clock.now();

    return this.dependencies.identityRepository.update({
      ...identity,
      status: "torched",
      torchedAt: now,
      updatedAt: now,
    });
  }

  async revokeIdentity(userId: string, identityId: string): Promise<IdentityRecord> {
    return this.torchIdentity(userId, identityId);
  }

  private async getOwnedIdentity(userId: string, identityId: string): Promise<IdentityRecord> {
    const ownerId = normalizeRequiredId(userId, "userId");
    const id = normalizeRequiredId(identityId, "identityId");
    const identity = await this.dependencies.identityRepository.findById(id);

    if (!identity || identity.userId !== ownerId) {
      throw new IdentityDomainError("identity_not_found", "The requested identity was not found.");
    }

    return identity;
  }

  private async materializeExpiration(identity: IdentityRecord): Promise<IdentityRecord> {
    if (identity.status !== "active" || !hasExpired(identity, this.clock.now())) {
      return identity;
    }

    return this.dependencies.identityRepository.update({
      ...identity,
      status: "expired",
      updatedAt: this.clock.now(),
    });
  }
}
