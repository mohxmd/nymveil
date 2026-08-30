import { describe, expect, test } from "bun:test";
import type {
  DestinationRecord,
  DestinationUseCases,
  IdentityDestinationOption,
} from "@nymveil/core";

import { createApp } from "../src/app";
import type { AuthInstance, AuthSession } from "../src/http/types";

const now = new Date("2026-08-30T12:00:00.000Z");

const session: AuthSession = {
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date("2026-09-01T12:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    token: "session-token",
  },
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  },
};

const destination: DestinationRecord = {
  id: "destination-1",
  userId: "user-1",
  provider: "discord",
  label: "Discord",
  targetRef: "provider-account-1",
  enabled: true,
  createdAt: now,
  updatedAt: now,
};

function createAuthMock(authSession: AuthSession | null = session): AuthInstance {
  return {
    api: {
      getSession: async () => authSession,
    },
    handler: async () => new Response(JSON.stringify({ status: "ok" })),
  } as unknown as AuthInstance;
}

function createDestinationUseCases(
  overrides: Partial<DestinationUseCases> = {},
): DestinationUseCases {
  return {
    listDestinations: async () => [destination],
    createDestination: async () => ({ ...destination, id: "destination-created" }),
    updateDestination: async () => ({ ...destination, enabled: false }),
    deleteDestination: async () => undefined,
    listIdentityDestinations: async () =>
      [{ destination, selected: true }] satisfies IdentityDestinationOption[],
    addIdentityDestination: async () => ({
      identityId: "identity-1",
      destinationId: destination.id,
      createdAt: now,
    }),
    removeIdentityDestination: async () => undefined,
    ...overrides,
  } as DestinationUseCases;
}

function createTestApp(
  overrides: Partial<DestinationUseCases> = {},
  authSession: AuthSession | null = session,
) {
  return createApp({
    auth: createAuthMock(authSession),
    corsOrigin: "http://localhost:5173",
    createDestinationUseCases: () => createDestinationUseCases(overrides),
    enableAuthLogging: false,
  });
}

describe("destination routes", () => {
  test("rejects unauthenticated requests", async () => {
    const response = await createTestApp({}, null).request("/api/destinations");

    expect(response.status).toBe(401);
  });

  test("returns safe destination metadata without target references", async () => {
    const app = createTestApp();
    const response = await app.request("/api/destinations");

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({
      destinations: [
        {
          id: "destination-1",
          provider: "discord",
          label: "Discord",
          enabled: true,
          available: true,
        },
      ],
    });
  });

  test("updates destination state through the authenticated use-case boundary", async () => {
    let received: { userId: string; destinationId: string; enabled: boolean } | undefined;
    const app = createTestApp({
      updateDestination: async (userId, destinationId, input) => {
        const enabled = input.enabled ?? destination.enabled;
        received = { userId, destinationId, enabled };
        return { ...destination, enabled };
      },
    });

    const response = await app.request("/api/destinations/destination-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(response.status).toBe(200);
    expect(received).toEqual({
      userId: "user-1",
      destinationId: "destination-1",
      enabled: false,
    });
    expect((await response.json()) as unknown).toMatchObject({
      destination: { enabled: false },
    });
  });

  test("creates a dashboard destination without accepting provider secrets", async () => {
    let received: unknown;
    const app = createTestApp({
      createDestination: async (_userId, input) => {
        received = input;
        return { ...destination, provider: "dashboard", targetRef: null };
      },
    });

    const response = await app.request("/api/destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "dashboard", label: "Dashboard", config: {} }),
    });

    expect(response.status).toBe(201);
    expect(received).toEqual({ provider: "dashboard", label: "Dashboard", targetRef: undefined });
    expect((await response.json()) as unknown).toMatchObject({
      destination: { provider: "dashboard", available: true },
    });
  });

  test("deletes an owned destination through the authenticated use-case boundary", async () => {
    let received: { userId: string; destinationId: string } | undefined;
    const app = createTestApp({
      deleteDestination: async (userId, destinationId) => {
        received = { userId, destinationId };
      },
    });

    const response = await app.request("/api/destinations/destination-1", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(received).toEqual({ userId: "user-1", destinationId: "destination-1" });
    expect((await response.json()) as unknown).toEqual({ ok: true });
  });

  test("supports identity route selection changes", async () => {
    let added = false;
    let removed = false;
    const app = createTestApp({
      addIdentityDestination: async () => {
        added = true;
        return { identityId: "identity-1", destinationId: destination.id, createdAt: now };
      },
      removeIdentityDestination: async () => {
        removed = true;
      },
    });

    const addResponse = await app.request("/api/identities/identity-1/destinations/destination-1", {
      method: "PUT",
    });
    const removeResponse = await app.request(
      "/api/identities/identity-1/destinations/destination-1",
      { method: "DELETE" },
    );

    expect(addResponse.status).toBe(200);
    expect(removeResponse.status).toBe(200);
    expect(added).toBe(true);
    expect(removed).toBe(true);
  });
});
