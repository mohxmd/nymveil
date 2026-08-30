import type { RequestEvent } from "@sveltejs/kit";
import { z } from "zod";

export type ApiFetcher = RequestEvent["fetch"];

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export async function requestJson<T>(
  fetcher: ApiFetcher,
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetcher(path, { ...init, headers });
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    // The response is handled as an invalid API response below.
  }

  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);

    throw new ApiRequestError(
      response.status,
      parsedError.success ? parsedError.data.error.code : "request_failed",
      parsedError.success ? parsedError.data.error.message : "The request could not be completed.",
    );
  }

  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiRequestError(502, "invalid_response", "The server returned an invalid response.");
  }

  return parsed.data;
}
