import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";
import { evlog } from "evlog/hono";
import { cors } from "hono/cors";

import type { AuthInstance } from "./http/types";
import { apiErrorHandler, apiNotFoundHandler } from "./http/errors";
import { requireSession } from "./http/auth-middleware";
import { serverFactory } from "./http/types";
import { createIdentityRoutes } from "./modules/identities";
import type { IdentityUseCases } from "@nymveil/core";

export interface AppDependencies {
  auth: AuthInstance;
  corsOrigin: string;
  enableAuthLogging?: boolean;
  createIdentityUseCases?: () => IdentityUseCases;
}

export function createApp({
  auth,
  corsOrigin,
  enableAuthLogging = true,
  createIdentityUseCases,
}: AppDependencies) {
  const app = serverFactory.createApp();

  app.use(evlog());

  if (enableAuthLogging) {
    const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
      exclude: ["/api/auth/**"],
      maskEmail: true,
    });

    app.use("*", async (c, next) => {
      await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
      await next();
    });
  }

  app.use(
    "/*",
    cors({
      origin: corsOrigin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

  if (createIdentityUseCases) {
    app.route("/api/identities", createIdentityRoutes({ auth, createIdentityUseCases }));
  }

  app.get("/api/me", requireSession(auth), (c) => {
    return c.json({ user: c.var.user });
  });

  app.get("/", (c) => c.text("OK"));
  app.notFound(apiNotFoundHandler);
  app.onError(apiErrorHandler);

  return app;
}
