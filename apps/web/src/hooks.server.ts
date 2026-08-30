import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";
import { createEvlogHooks } from "evlog/sveltekit";

import { getCurrentUser } from "$lib/server/auth/session";

const { handle: evlogHandle, handleError } = createEvlogHooks();

const authenticationHandle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;

  if (event.url.pathname === "/dashboard" || event.url.pathname.startsWith("/dashboard/")) {
    event.locals.user = await getCurrentUser(event);
  }

  return resolve(event);
};

export const handle = sequence(evlogHandle, authenticationHandle);

export { handleError };
