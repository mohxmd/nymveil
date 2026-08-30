import { describe, expect, test } from "bun:test";
import { IdentityDomainError, type IdentityRecord, type IdentityUseCases } from "@nymveil/core";

import { createApp } from "../src/app";
import type { RateLimiter } from "../src/http/rate-limit";
import type { AuthInstance, AuthSession } from "../src/http/types";

const identity: IdentityRecord = {
  id: "identity-1",
  userId: "user-1",
  domainId: "domain-1",
  localPart: "github-k7x2",
  address: "github-k7x2@example.com",
  label: "GitHub",
  status: "active",
  expiresAt: null,
  torchedAt: null,
  createdAt: new Date("2026-08-30T12:00:00.000Z"),
  updatedAt: new Date("2026-08-30T12:00:00.000Z"),
};

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

function createTestApp(
  overrides: Partial<IdentityUseCases> = {},
  authSession: AuthSession | null = authenticatedSession,
  identityCreationRateLimiter?: RateLimiter,
) {
  const calls = {
    create: [] as unknown[],
    list: [] as string[],
    get: [] as string[],
    update: [] as unknown[],
    torch: [] as string[],
  };
  const useCases = {
    createIdentity: async (input: unknown) => {
      calls.create.push(input);
      return identity;
    },
    listIdentities: async (userId: string) => {
      calls.list.push(userId);
      return [identity];
    },
    getIdentity: async (_userId: string, identityId: string) => {
      calls.get.push(identityId);
      return identity;
    },
    updateIdentity: async (_userId: string, identityId: string, input: unknown) => {
      calls.update.push({ identityId, input });
      return { ...identity, label: "Updated GitHub" };
    },
    torchIdentity: async (_userId: string, identityId: string) => {
      calls.torch.push(identityId);
      return { ...identity, status: "torched", torchedAt: identity.updatedAt };
    },
    ...overrides,
  } as unknown as IdentityUseCases;

  return {
    calls,
    app: createApp({
      auth: createAuthMock(authSession),
      corsOrigin: "http://localhost:5173",
      createIdentityUseCases: () => useCases,
      identityCreationRateLimiter,
      enableAuthLogging: false,
    }),
  };
}

describe("identity routes", () => {
  test("rejects unauthenticated requests", async () => {
    const { app } = createTestApp({}, null);

    const response = await app.request("/api/identities");

    expect(response.status).toBe(401);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "unauthenticated",
        message: "Authentication is required.",
      },
    });
  });

  test("creates an identity with the authenticated owner", async () => {
    const { app, calls } = createTestApp();
    const response = await app.request("/api/identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domainId: "domain-1",
        label: "GitHub",
        expiresAt: "2026-09-01T12:00:00.000Z",
      }),
    });

    expect(response.status).toBe(201);
    expect(calls.create).toEqual([
      {
        userId: "user-1",
        domainId: "domain-1",
        label: "GitHub",
        expiresAt: new Date("2026-09-01T12:00:00.000Z"),
      },
    ]);
    expect((await response.json()) as unknown).toMatchObject({
      identity: { id: "identity-1", address: "github-k7x2@example.com" },
    });
  });

  test("limits identity creation without invoking the use-case", async () => {
    const limiter: RateLimiter = {
      limit: async () => ({ success: false }),
    };
    const { app, calls } = createTestApp({}, authenticatedSession, limiter);

    const response = await app.request("/api/identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId: "domain-1", label: "GitHub" }),
    });

    expect(response.status).toBe(429);
    expect(calls.create).toHaveLength(0);
  });

  test("lists and reads only through the authenticated use-case boundary", async () => {
    const { app, calls } = createTestApp();

    const listResponse = await app.request("/api/identities");
    const getResponse = await app.request("/api/identities/identity-1");

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(calls.list).toEqual(["user-1"]);
    expect(calls.get).toEqual(["identity-1"]);
  });

  test("validates updates and forwards valid updates", async () => {
    const { app, calls } = createTestApp();

    const invalidResponse = await app.request("/api/identities/identity-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const validResponse = await app.request("/api/identities/identity-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "GitHub account" }),
    });

    expect(invalidResponse.status).toBe(400);
    expect(validResponse.status).toBe(200);
    expect(calls.update).toEqual([
      {
        identityId: "identity-1",
        input: { label: "GitHub account", expiresAt: undefined },
      },
    ]);
  });

  test("maps ownership failures to a non-disclosing not-found response", async () => {
    const { app } = createTestApp({
      getIdentity: async () => {
        throw new IdentityDomainError(
          "identity_not_found",
          "The requested identity was not found.",
        );
      },
    });

    const response = await app.request("/api/identities/identity-1");

    expect(response.status).toBe(404);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "not_found",
        message: "The requested resource was not found.",
      },
    });
  });

  test("returns expired identities with their lifecycle state", async () => {
    const expiredIdentity: IdentityRecord = {
      ...identity,
      status: "expired",
      expiresAt: new Date("2026-08-29T12:00:00.000Z"),
      updatedAt: new Date("2026-08-30T12:00:00.000Z"),
    };
    const { app } = createTestApp({
      getIdentity: async () => expiredIdentity,
    });

    const response = await app.request("/api/identities/identity-1");

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toMatchObject({
      identity: {
        status: "expired",
        expiresAt: "2026-08-29T12:00:00.000Z",
      },
    });
  });

  test("maps duplicate identity addresses to a conflict response", async () => {
    const { app } = createTestApp({
      createIdentity: async () => {
        throw new IdentityDomainError(
          "identity_address_conflict",
          "The generated identity address is already in use.",
        );
      },
    });

    const response = await app.request("/api/identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId: "domain-1", label: "GitHub" }),
    });

    expect(response.status).toBe(409);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "conflict",
        message: "The identity address could not be allocated.",
      },
    });
  });

  test("torches an identity through the authenticated owner", async () => {
    const { app, calls } = createTestApp();

    const response = await app.request("/api/identities/identity-1/torch", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(calls.torch).toEqual(["identity-1"]);
    expect((await response.json()) as unknown).toMatchObject({
      identity: { status: "torched" },
    });
  });
});
