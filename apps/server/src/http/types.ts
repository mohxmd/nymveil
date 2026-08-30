import { createFactory } from "hono/factory";
import type { EvlogVariables } from "evlog/hono";

import type { createAuth } from "@nymveil/auth";

export type AuthInstance = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<AuthInstance["api"]["getSession"]>>>;
export type AuthUser = AuthSession["user"];

export type ServerEnv = EvlogVariables & {
  Variables: {
    session: AuthSession;
    user: AuthUser;
  };
};

export const serverFactory = createFactory<ServerEnv>();
