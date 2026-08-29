import { describe, expect, test } from "bun:test";
import { IdentityDomainError, type IdentityRecord, type IdentityUseCases } from "@nymveil/core";

import { createApp } from "../src/app";
import type { AuthInstance } from "../src/http/types";

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

const session = {
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date("2026-09-01T12:00:00.000Z"),
  },
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  },
};

function createAuthMock(): AuthInstance {
  return {
    api: {
      getSession: async () => session,
    },
    handler: async () => new Response(JSON.stringify({ status: "ok" })),
  } as unknown as AuthInstance;
}

function createTestApp(overrides: Partial<IdentityUseCases> = {}) {
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
      auth: createAuthMock(),
      corsOrigin: "http://localhost:5173",
      createIdentityUseCases: () => useCases,
      enableAuthLogging: false,
    }),
  };
}

describe("identity routes", () => {
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
