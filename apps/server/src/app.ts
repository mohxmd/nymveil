import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";
import { evlog } from "evlog/hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type {
  DeliveryMetadataUseCases,
  DestinationUseCases,
  DomainRepository,
  IdentityUseCases,
} from "@nymveil/core";

import type { AuthInstance } from "./http/types";
import { apiErrorHandler, apiNotFoundHandler } from "./http/errors";
import { requireSession } from "./http/auth-middleware";
import { serverFactory } from "./http/types";
import { createIdentityRoutes } from "./modules/identities";
import { createDomainRoutes } from "./modules/domains";
import { createDestinationRoutes } from "./modules/destinations";
import { createDeliveryMetadataRoutes } from "./modules/delivery-metadata";
import { createApiRateLimitMiddleware, type RateLimiter } from "./http/rate-limit";

export interface AppDependencies {
  auth: AuthInstance;
  corsOrigin: string;
  apiRateLimiter?: RateLimiter;
  identityCreationRateLimiter?: RateLimiter;
  enableAuthLogging?: boolean;
  createIdentityUseCases?: () => IdentityUseCases;
  createDomainRepository?: () => DomainRepository;
  createDestinationUseCases?: () => DestinationUseCases;
  createDeliveryMetadataUseCases?: () => DeliveryMetadataUseCases;
}

export function createApp({
  auth,
  corsOrigin,
  apiRateLimiter,
  identityCreationRateLimiter,
  enableAuthLogging = true,
  createIdentityUseCases,
  createDomainRepository,
  createDestinationUseCases,
  createDeliveryMetadataUseCases,
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
      allowMethods: ["DELETE", "GET", "PATCH", "POST", "PUT", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.use("/*", secureHeaders());

  if (apiRateLimiter) {
    app.use("/api/*", createApiRateLimitMiddleware(auth, apiRateLimiter));
  }

  app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

  if (createIdentityUseCases) {
    app.route(
      "/api/identities",
      createIdentityRoutes({ auth, createIdentityUseCases, identityCreationRateLimiter }),
    );
  }

  if (createDomainRepository) {
    app.route(
      "/api/domains",
      createDomainRoutes({ auth, domainRepository: createDomainRepository() }),
    );
  }

  if (createDestinationUseCases) {
    app.route("/api", createDestinationRoutes({ auth, createDestinationUseCases }));
  }

  if (createDeliveryMetadataUseCases) {
    app.route("/api", createDeliveryMetadataRoutes({ auth, createDeliveryMetadataUseCases }));
  }

  app.get("/api/me", requireSession(auth), (c) => {
    return c.json({ user: c.var.user });
  });

  app.get("/", (c) => c.text("OK"));
  app.notFound(apiNotFoundHandler);
  app.onError(apiErrorHandler);

  return app;
}
