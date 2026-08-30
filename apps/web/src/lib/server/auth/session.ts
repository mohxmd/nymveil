import { error, type RequestEvent } from "@sveltejs/kit";
import { z } from "zod";

const currentUserResponseSchema = z.object({
  user: z.looseObject({
    id: z.string().min(1),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
  }),
});

export type AuthUser = z.infer<typeof currentUserResponseSchema>["user"];

export async function getCurrentUser(
  event: Pick<RequestEvent, "fetch" | "request">,
): Promise<AuthUser | null> {
  if (!event.request.headers.has("cookie")) {
    return null;
  }

  const response = await event.fetch("/api/me", {
    headers: {
      cookie: event.request.headers.get("cookie") ?? "",
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw error(503, "The authentication service is unavailable.");
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw error(502, "The authentication service returned an invalid response.");
  }

  const result = currentUserResponseSchema.safeParse(payload);

  if (!result.success) {
    throw error(502, "The authentication service returned an invalid response.");
  }

  return result.data.user;
}
