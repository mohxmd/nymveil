import "../../../packages/env/env.d.ts";
import type { RequestLogger } from "evlog";
import type { AuthUser } from "$lib/server/auth/session";
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      log: RequestLogger;
      user: AuthUser | null;
    }
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf: IncomingRequestCfProperties;
    }
  }
}

export {};
