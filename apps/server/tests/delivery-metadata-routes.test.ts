import { describe, expect, test } from "bun:test";

import type { DeliveryAttemptRecord, DeliveryMetadataUseCases } from "@nymveil/core";

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

const attempt: DeliveryAttemptRecord = {
  id: "attempt-1",
  deliveryKey: "message-1:destination-1",
  userId: "user-1",
  identityId: "identity-1",
  destinationId: "destination-1",
  provider: "discord",
  status: "failed",
  attemptedAt: now,
  completedAt: now,
  errorCode: "provider_rejected",
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

function createDeliveryMetadataUseCases(
  listRecentAttempts: DeliveryMetadataUseCases["listRecentAttempts"] = async () => [attempt],
): DeliveryMetadataUseCases {
  return { listRecentAttempts } as DeliveryMetadataUseCases;
}

function createTestApp(
  listRecentAttempts?: DeliveryMetadataUseCases["listRecentAttempts"],
  authSession: AuthSession | null = session,
) {
  return createApp({
    auth: createAuthMock(authSession),
    corsOrigin: "http://localhost:5173",
    createDeliveryMetadataUseCases: () => createDeliveryMetadataUseCases(listRecentAttempts),
    enableAuthLogging: false,
  });
}

describe("delivery metadata routes", () => {
  test("rejects unauthenticated requests", async () => {
    const response = await createTestApp(undefined, null).request("/api/delivery-attempts");

    expect(response.status).toBe(401);
  });

  test("returns safe delivery metadata for the authenticated user", async () => {
    let received: { userId: string; limit: number } | undefined;
    const response = await createTestApp(async (userId, limit) => {
      received = { userId, limit: limit ?? 50 };
      return [attempt];
    }).request("/api/delivery-attempts?limit=2");

    expect(response.status).toBe(200);
    expect(received).toEqual({ userId: "user-1", limit: 2 });
    expect((await response.json()) as unknown).toEqual({
      attempts: [
        {
          id: "attempt-1",
          identityId: "identity-1",
          destinationId: "destination-1",
          provider: "discord",
          status: "failed",
          attemptedAt: now.toISOString(),
          completedAt: now.toISOString(),
          errorCode: "provider_rejected",
        },
      ],
    });
  });

  test("does not expose delivery keys or user ids", async () => {
    const response = await createTestApp().request("/api/delivery-attempts");
    const body = (await response.json()) as { attempts: Record<string, unknown>[] };

    expect(body.attempts[0]).not.toHaveProperty("deliveryKey");
    expect(body.attempts[0]).not.toHaveProperty("userId");
  });

  test("rejects invalid query parameters with a safe error", async () => {
    const response = await createTestApp().request("/api/delivery-attempts?limit=101");

    expect(response.status).toBe(400);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "bad_request",
        message: "The delivery metadata query is invalid.",
      },
    });
  });
});
