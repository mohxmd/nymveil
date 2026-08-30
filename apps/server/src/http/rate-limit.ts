import type { AuthInstance } from "./types";
import { ApiError } from "./errors";
import { serverFactory } from "./types";

export interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";
const RATE_LIMIT_UNAVAILABLE_MESSAGE = "Request protection is temporarily unavailable.";

type ServerContext = Parameters<ReturnType<typeof serverFactory.createMiddleware>>[0];

function rateLimitExceeded(): ApiError {
  return new ApiError("rate_limited", 429, RATE_LIMIT_MESSAGE);
}

function clientAddress(c: ServerContext) {
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

async function enforceRateLimit(
  c: ServerContext,
  limiter: RateLimiter,
  key: string,
): Promise<void> {
  try {
    const result = await limiter.limit({ key });

    if (!result.success) {
      throw rateLimitExceeded();
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    c.get("log")?.error(new Error("The configured rate limiter is unavailable."));
    throw new ApiError("internal_error", 503, RATE_LIMIT_UNAVAILABLE_MESSAGE);
  }
}

export function createApiRateLimitMiddleware(auth: AuthInstance, limiter: RateLimiter) {
  return serverFactory.createMiddleware(async (c, next) => {
    if (c.req.method !== "OPTIONS") {
      const isAuthRequest = c.req.path === "/api/auth" || c.req.path.startsWith("/api/auth/");
      const session = isAuthRequest
        ? null
        : await auth.api.getSession({ headers: c.req.raw.headers });
      const key = session ? `api:user:${session.user.id}` : `api:ip:${clientAddress(c)}`;

      await enforceRateLimit(c, limiter, key);
    }

    await next();
  });
}

export function createUserRateLimitMiddleware(limiter: RateLimiter, scope: string) {
  return serverFactory.createMiddleware(async (c, next) => {
    await enforceRateLimit(c, limiter, `${scope}:user:${c.var.user.id}`);
    await next();
  });
}
