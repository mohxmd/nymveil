import { describe, expect, test } from "bun:test";
import type { DomainRecord, DomainRepository } from "@nymveil/core";

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

function createDomainRepository(domains: DomainRecord[]): DomainRepository {
  return {
    findById: async (id) => domains.find((domain) => domain.id === id) ?? null,
    listByUserId: async (userId) => domains.filter((domain) => domain.userId === userId),
  };
}

describe("domain routes", () => {
  test("rejects unauthenticated requests", async () => {
    const app = createApp({
      auth: createAuthMock(null),
      corsOrigin: "http://localhost:5173",
      createDomainRepository: () => createDomainRepository([]),
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
      },
      {
        id: "domain-2",
        userId: "user-2",
        hostname: "other.example.com",
        status: "verified",
      },
    ];
    const app = createApp({
      auth: createAuthMock(),
      corsOrigin: "http://localhost:5173",
      createDomainRepository: () => createDomainRepository(domains),
      enableAuthLogging: false,
    });

    const response = await app.request("/api/domains");

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      domains: [domains[0]],
    });
  });
});
