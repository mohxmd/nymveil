import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import type { RateLimiter } from "../src/http/rate-limit";
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

function createLimiter(success: boolean) {
  const keys: string[] = [];
  const limiter: RateLimiter = {
    limit: async ({ key }) => {
      keys.push(key);
      return { success };
    },
  };

  return { keys, limiter };
}

describe("security middleware", () => {
  test("rejects over-limit API requests with retry metadata", async () => {
    const { keys, limiter } = createLimiter(false);
    const app = createApp({
      auth: createAuthMock(session),
      corsOrigin: "http://localhost:5173",
      apiRateLimiter: limiter,
      enableAuthLogging: false,
    });

    const response = await app.request("/api/me", {
      headers: { Cookie: "better-auth.session_token=test" },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(keys).toEqual(["api:user:user-1"]);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "rate_limited",
        message: "Too many requests. Please try again later.",
      },
    });
  });

  test("uses the client address for unauthenticated auth requests", async () => {
    const { keys, limiter } = createLimiter(true);
    const app = createApp({
      auth: createAuthMock(null),
      corsOrigin: "http://localhost:5173",
      apiRateLimiter: limiter,
      enableAuthLogging: false,
    });

    const response = await app.request("/api/auth/sign-in", {
      headers: { "CF-Connecting-IP": "203.0.113.10" },
    });

    expect(response.status).toBe(200);
    expect(keys).toEqual(["api:ip:203.0.113.10"]);
  });

  test("fails closed when the rate limiter is unavailable", async () => {
    const limiter: RateLimiter = {
      limit: async () => {
        throw new Error("binding unavailable");
      },
    };
    const app = createApp({
      auth: createAuthMock(null),
      corsOrigin: "http://localhost:5173",
      apiRateLimiter: limiter,
      enableAuthLogging: false,
    });

    const response = await app.request("/api/me");

    expect(response.status).toBe(503);
    expect((await response.json()) as unknown).toEqual({
      error: {
        code: "internal_error",
        message: "Request protection is temporarily unavailable.",
      },
    });
  });
});
