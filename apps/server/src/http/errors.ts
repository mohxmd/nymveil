import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ServerEnv } from "./types";

export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "bad_request"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(
  c: Parameters<ErrorHandler<ServerEnv>>[1],
  code: ApiErrorCode,
  status: ContentfulStatusCode,
  message: string,
) {
  if (status === 429) {
    c.header("Retry-After", "60");
  }

  return c.json<ApiErrorBody>({ error: { code, message } }, status);
}

function errorCodeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 500) return "internal_error";
  return "bad_request";
}

export const apiErrorHandler: ErrorHandler<ServerEnv> = (error, c) => {
  if (error instanceof ApiError) {
    return apiErrorResponse(c, error.code, error.status, error.message);
  }

  if (error instanceof HTTPException) {
    return apiErrorResponse(
      c,
      errorCodeForStatus(error.status),
      error.status,
      error.message || "Request failed.",
    );
  }

  c.get("log")?.error(error instanceof Error ? error : new Error(String(error)));
  return apiErrorResponse(c, "internal_error", 500, "An internal server error occurred.");
};

export const apiNotFoundHandler: NotFoundHandler<ServerEnv> = (c) =>
  apiErrorResponse(c, "not_found", 404, "The requested resource was not found.");
