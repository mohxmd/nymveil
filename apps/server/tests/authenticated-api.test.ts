import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import type { AuthInstance } from "../src/http/types";

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

function createAuthMock(sessionValue: typeof session | null): AuthInstance {
  return {
    api: {
      getSession: async () => sessionValue,
    },
    handler: async () => new Response(JSON.stringify({ status: "ok" })),
  } as unknown as AuthInstance;
}

describe("authenticated API foundation", () => {
  test("rejects unauthenticated requests with a consistent error body", async () => {
    const app = createApp({
      auth: createAuthMock(null),
      corsOrigin: "http://localhost:5173",
      enableAuthLogging: false,
    });

    const response = await app.request("/api/me");

    expect(response.status).toBe(401);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "unauthenticated",
        message: "Authentication is required.",
      },
    });
  });

  test("makes the authenticated user available to the handler", async () => {
    const app = createApp({
      auth: createAuthMock(session),
      corsOrigin: "http://localhost:5173",
      enableAuthLogging: false,
    });

    const response = await app.request("/api/me", {
      headers: { Cookie: "better-auth.session_token=test" },
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as unknown).toEqual({ user: session.user });
  });

  test("returns a consistent not-found response", async () => {
    const app = createApp({
      auth: createAuthMock(null),
      corsOrigin: "http://localhost:5173",
      enableAuthLogging: false,
    });

    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "not_found",
        message: "The requested resource was not found.",
      },
    });
  });
});
