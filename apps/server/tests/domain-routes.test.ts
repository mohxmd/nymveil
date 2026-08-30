import { describe, expect, test } from "bun:test";
import type { DomainRecord, DomainUseCases } from "@nymveil/core";

import { createApp } from "../src/app";
import type { AuthInstance, AuthSession } from "../src/http/types";

const authenticatedSession: AuthSession = {
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date("2026-09-01T12:00:00.000Z"),
    createdAt: new Date("2026-08-30T12:00:00.000Z"),
    updatedAt: new Date("2026-08-30T12:00:00.000Z"),
    token: "session-token",
  },
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: new Date("2026-08-30T12:00:00.000Z"),
    updatedAt: new Date("2026-08-30T12:00:00.000Z"),
  },
};

function createAuthMock(authSession: AuthSession | null = authenticatedSession): AuthInstance {
  return {
    api: {
      getSession: async () => authSession,
    },
    handler: async () => new Response(JSON.stringify({ status: "ok" })),
  } as unknown as AuthInstance;
}

const now = new Date("2026-08-30T12:00:00.000Z");

function createDomainUseCases(
  domains: DomainRecord[],
  overrides: Partial<DomainUseCases> = {},
): DomainUseCases {
  return {
    listDomains: async (userId) => domains.filter((domain) => domain.userId === userId),
    createDomain: async () => {
      throw new Error("createDomain was not configured for this test");
    },
    rotateVerificationToken: async () => {
      throw new Error("rotateVerificationToken was not configured for this test");
    },
    verifyDomain: async () => {
      throw new Error("verifyDomain was not configured for this test");
    },
    ...overrides,
  } as DomainUseCases;
}

describe("domain routes", () => {
  test("rejects unauthenticated requests", async () => {
    const app = createApp({
      auth: createAuthMock(null),
      corsOrigin: "http://localhost:5173",
      createDomainUseCases: () => createDomainUseCases([]),
      enableAuthLogging: false,
    });

    const response = await app.request("/api/domains");

    expect(response.status).toBe(401);
  });

  test("lists only domains belonging to the authenticated user", async () => {
    const domains: DomainRecord[] = [
      {
        id: "domain-1",
        userId: "user-1",
        hostname: "example.com",
        status: "verified",
        verificationTokenHash: null,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "domain-2",
        userId: "user-2",
        hostname: "other.example.com",
        status: "verified",
        verificationTokenHash: null,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const app = createApp({
      auth: createAuthMock(),
      corsOrigin: "http://localhost:5173",
      createDomainUseCases: () => createDomainUseCases(domains),
      enableAuthLogging: false,
    });

    const response = await app.request("/api/domains");

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      domains: [
        {
          id: "domain-1",
          userId: "user-1",
          hostname: "example.com",
          status: "verified",
          verifiedAt: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });
  });

  test("creates a domain and returns setup instructions without the stored hash", async () => {
    const domain: DomainRecord = {
      id: "domain-3",
      userId: "user-1",
      hostname: "example.com",
      status: "pending",
      verificationTokenHash: "private-hash",
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    let input: unknown;
    const app = createApp({
      auth: createAuthMock(),
      corsOrigin: "http://localhost:5173",
      createDomainUseCases: () =>
        createDomainUseCases([], {
          createDomain: async (value) => {
            input = value;
            return { domain, verificationToken: "token-one-123456" };
          },
        }),
      enableAuthLogging: false,
    });

    const response = await app.request("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname: " Example.COM. " }),
    });

    expect(response.status).toBe(201);
    expect(input).toEqual({ userId: "user-1", hostname: "Example.COM." });
    expect((await response.json()) as unknown).toEqual({
      domain: {
        id: "domain-3",
        userId: "user-1",
        hostname: "example.com",
        status: "pending",
        verifiedAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      verification: {
        type: "TXT",
        name: "_nymveil-challenge.example.com",
        value: "token-one-123456",
      },
    });
  });

  test("rotates a pending domain token for the authenticated owner", async () => {
    const domain: DomainRecord = {
      id: "domain-1",
      userId: "user-1",
      hostname: "example.com",
      status: "pending",
      verificationTokenHash: "private-hash",
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const app = createApp({
      auth: createAuthMock(),
      corsOrigin: "http://localhost:5173",
      createDomainUseCases: () =>
        createDomainUseCases([], {
          rotateVerificationToken: async (userId, domainId) => {
            expect(userId).toBe("user-1");
            expect(domainId).toBe("domain-1");
            return { domain, verificationToken: "token-two-123456" };
          },
        }),
      enableAuthLogging: false,
    });

    const response = await app.request("/api/domains/domain-1/verification-token", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toMatchObject({
      verification: { value: "token-two-123456" },
    });
  });

  test("verifies a domain through the authenticated owner", async () => {
    const verifiedDomain: DomainRecord = {
      id: "domain-1",
      userId: "user-1",
      hostname: "example.com",
      status: "verified",
      verificationTokenHash: null,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    let input: { userId: string; domainId: string; token: string } | undefined;
    const app = createApp({
      auth: createAuthMock(),
      corsOrigin: "http://localhost:5173",
      createDomainUseCases: () =>
        createDomainUseCases([], {
          verifyDomain: async (userId, domainId, token) => {
            input = { userId, domainId, token };
            return verifiedDomain;
          },
        }),
      enableAuthLogging: false,
    });

    const response = await app.request("/api/domains/domain-1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationToken: "token-one-123456" }),
    });

    expect(response.status).toBe(200);
    expect(input).toEqual({ userId: "user-1", domainId: "domain-1", token: "token-one-123456" });
    const body = (await response.json()) as { domain: Record<string, unknown> };
    expect(body.domain.status).toBe("verified");
    expect(body.domain).not.toHaveProperty("verificationTokenHash");
  });
});
