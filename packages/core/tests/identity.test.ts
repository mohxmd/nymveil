import { describe, expect, test } from "bun:test";

import { IdentityDomainError, IdentityUseCases } from "../src";
import type {
  Clock,
  DomainRecord,
  DomainRepository,
  IdentityRecord,
  IdentityRepository,
} from "../src";

const now = new Date("2026-08-29T12:00:00.000Z");

class FixedClock implements Clock {
  constructor(private readonly currentTime: Date) {}

  now(): Date {
    return new Date(this.currentTime);
  }
}

class InMemoryIdentityRepository implements IdentityRepository {
  readonly identities = new Map<string, IdentityRecord>();

  constructor(readonly domains: DomainRecord[]) {}

  async findById(id: string): Promise<IdentityRecord | null> {
    return this.identities.get(id) ?? null;
  }

  async findByAddress(address: string): Promise<IdentityRecord | null> {
    return [...this.identities.values()].find((identity) => identity.address === address) ?? null;
  }

  async listByUserId(userId: string): Promise<IdentityRecord[]> {
    return [...this.identities.values()].filter((identity) => identity.userId === userId);
  }

  async create(identity: IdentityRecord): Promise<IdentityRecord> {
    this.identities.set(identity.id, identity);
    return identity;
  }

  async update(identity: IdentityRecord): Promise<IdentityRecord> {
    this.identities.set(identity.id, identity);
    return identity;
  }
}

function createUseCases(
  domain: DomainRecord = {
    id: "domain-1",
    userId: "user-1",
    hostname: "Example.com.",
    status: "verified",
  },
) {
  const repository = new InMemoryIdentityRepository([domain]);
  const domainRepository: DomainRepository = {
    findById: async (id) => repository.domains.find((candidate) => candidate.id === id) ?? null,
  };

  return {
    repository,
    useCases: new IdentityUseCases({
      clock: new FixedClock(now),
      domainRepository,
      identityRepository: repository,
      idGenerator: { generate: () => "identity-1" },
      localPartGenerator: { generate: () => "github-k7x2" },
    }),
  };
}

describe("IdentityUseCases", () => {
  test("creates a normalized identity on a verified owned domain", async () => {
    const { useCases } = createUseCases();

    const identity = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "  GitHub   account  ",
      expiresAt: new Date("2026-09-01T12:00:00.000Z"),
    });

    expect(identity).toMatchObject({
      id: "identity-1",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "github-k7x2",
      address: "github-k7x2@example.com",
      label: "GitHub account",
      status: "active",
      torchedAt: null,
    });
  });

  test("does not create identities on unverified or foreign domains", async () => {
    const unverified = createUseCases({
      id: "domain-1",
      userId: "user-1",
      hostname: "example.com",
      status: "pending",
    });
    const foreign = createUseCases({
      id: "domain-1",
      userId: "user-2",
      hostname: "example.com",
      status: "verified",
    });

    const input = { userId: "user-1", domainId: "domain-1", label: "GitHub" };

    await expect(unverified.useCases.createIdentity(input)).rejects.toMatchObject({
      code: "domain_not_usable",
    });
    await expect(foreign.useCases.createIdentity(input)).rejects.toMatchObject({
      code: "domain_not_usable",
    });
  });

  test("retries when a generated address is already allocated", async () => {
    const { repository } = createUseCases();
    const useCases = new IdentityUseCases({
      clock: new FixedClock(now),
      domainRepository: {
        findById: async () => ({
          id: "domain-1",
          userId: "user-1",
          hostname: "example.com",
          status: "verified",
        }),
      },
      identityRepository: repository,
      idGenerator: { generate: () => "identity-2" },
      localPartGenerator: {
        generate: (() => {
          const localParts = ["github-k7x2", "github-p9m4"];
          return () => localParts.shift() as string;
        })(),
      },
    });

    await repository.create({
      id: "identity-1",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "github-k7x2",
      address: "github-k7x2@example.com",
      label: "Existing",
      status: "active",
      expiresAt: null,
      torchedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const identity = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });

    expect(identity.address).toBe("github-p9m4@example.com");
  });

  test("materializes expiration using trusted server time", async () => {
    const { useCases, repository } = createUseCases();
    const identity = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });
    await repository.update({
      ...identity,
      expiresAt: new Date("2026-08-29T11:59:00.000Z"),
    });

    const resolved = await useCases.getIdentity("user-1", identity.id);

    expect(resolved.status).toBe("expired");
    expect(repository.identities.get(identity.id)?.status).toBe("expired");
  });

  test("lists owned identities and updates active identity metadata", async () => {
    const { useCases } = createUseCases();
    const identity = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });

    const updated = await useCases.updateIdentity("user-1", identity.id, {
      label: "GitHub account",
      expiresAt: new Date("2026-09-01T12:00:00.000Z"),
    });

    expect(updated.label).toBe("GitHub account");
    expect(updated.expiresAt).toEqual(new Date("2026-09-01T12:00:00.000Z"));
    expect(await useCases.listIdentities("user-1")).toEqual([updated]);
  });

  test("allows torch from active or expired and rejects torch after torch", async () => {
    const { useCases } = createUseCases();
    const identity = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });

    const torched = await useCases.revokeIdentity("user-1", identity.id);

    expect(torched.status).toBe("torched");
    expect(torched.torchedAt).toEqual(now);
    await expect(useCases.torchIdentity("user-1", identity.id)).rejects.toMatchObject({
      code: "invalid_lifecycle_transition",
    });
  });

  test("hides identities owned by another user", async () => {
    const { useCases } = createUseCases();
    const identity = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });

    await expect(useCases.getIdentity("user-2", identity.id)).rejects.toBeInstanceOf(
      IdentityDomainError,
    );
    await expect(useCases.getIdentity("user-2", identity.id)).rejects.toMatchObject({
      code: "identity_not_found",
    });
  });
});
