import { describe, expect, test } from "bun:test";

import {
  DomainDomainError,
  DomainUseCases,
  type DomainManagementRepository,
  type DomainRecord,
} from "../src";

const now = new Date("2026-08-30T12:00:00.000Z");

function createContext(
  verification: "verified" | "not_found" | "unavailable" = "verified",
  tokens = ["token-one-123456", "token-two-123456"],
) {
  const records = new Map<string, DomainRecord>();
  const repository: DomainManagementRepository = {
    findById: async (id) => records.get(id) ?? null,
    findByHostname: async (hostname) =>
      [...records.values()].find((domain) => domain.hostname === hostname) ?? null,
    listByUserId: async (userId) =>
      [...records.values()].filter((domain) => domain.userId === userId),
    create: async (domain) => {
      records.set(domain.id, domain);
      return domain;
    },
    update: async (domain) => {
      records.set(domain.id, domain);
      return domain;
    },
  };
  let tokenIndex = 0;

  const useCases = new DomainUseCases({
    clock: { now: () => now },
    domainRepository: repository,
    challengeHasher: {
      hash: async (value) => `hash:${value}`,
      verify: async (value, expectedHash) => expectedHash === `hash:${value}`,
    },
    tokenGenerator: {
      generate: () => tokens[tokenIndex++] ?? "token-fallback-123456",
    },
    verifier: {
      verify: async () => verification,
    },
  });

  return { records, useCases };
}

describe("DomainUseCases", () => {
  test("normalizes a new hostname and returns a one-time verification token", async () => {
    const { useCases } = createContext();

    const result = await useCases.createDomain({
      userId: "user-1",
      hostname: " Example.COM. ",
    });

    expect(result).toMatchObject({
      verificationToken: "token-one-123456",
      domain: {
        userId: "user-1",
        hostname: "example.com",
        status: "pending",
        verificationTokenHash: "hash:token-one-123456",
        verifiedAt: null,
      },
    });
  });

  test("rejects duplicate hostnames and protects ownership", async () => {
    const { useCases } = createContext();
    const created = await useCases.createDomain({ userId: "user-1", hostname: "example.com" });

    await expect(
      useCases.createDomain({ userId: "user-2", hostname: "EXAMPLE.COM" }),
    ).rejects.toMatchObject<Partial<DomainDomainError>>({ code: "domain_hostname_conflict" });
    await expect(
      useCases.verifyDomain("user-2", created.domain.id, created.verificationToken),
    ).rejects.toMatchObject<Partial<DomainDomainError>>({ code: "domain_not_found" });
  });

  test("verifies a pending domain and clears its stored challenge hash", async () => {
    const { useCases, records } = createContext();
    const created = await useCases.createDomain({ userId: "user-1", hostname: "example.com" });

    const verified = await useCases.verifyDomain(
      "user-1",
      created.domain.id,
      created.verificationToken,
    );

    expect(verified).toMatchObject({
      status: "verified",
      verifiedAt: now,
      verificationTokenHash: null,
    });
    expect(records.get(created.domain.id)?.status).toBe("verified");
  });

  test("keeps verification pending when DNS is missing or unavailable", async () => {
    for (const check of ["not_found", "unavailable"] as const) {
      const { useCases } = createContext(check);
      const created = await useCases.createDomain({
        userId: "user-1",
        hostname: `${check.replace("_", "-")}.example.com`,
      });

      await expect(
        useCases.verifyDomain("user-1", created.domain.id, created.verificationToken),
      ).rejects.toMatchObject<Partial<DomainDomainError>>({
        code:
          check === "not_found" ? "domain_verification_failed" : "domain_verification_unavailable",
      });
    }
  });
});
