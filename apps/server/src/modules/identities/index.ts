import { zValidator } from "@hono/zod-validator";
import { IdentityDomainError, type IdentityUseCases } from "@nymveil/core";

import { requireSession } from "../../http/auth-middleware";
import { ApiError, apiErrorHandler } from "../../http/errors";
import { serverFactory, type AuthInstance } from "../../http/types";
import { createIdentityService, serializeIdentity, type IdentityService } from "./service";
import { IdentityModel } from "./model";

function toIdentityApiError(error: unknown): ApiError | undefined {
  if (!(error instanceof IdentityDomainError)) {
    return undefined;
  }

  if (error.code === "identity_address_conflict") {
    return new ApiError("conflict", 409, "The identity address could not be allocated.");
  }

  if (error.code === "identity_not_found" || error.code === "domain_not_found") {
    return new ApiError("not_found", 404, "The requested resource was not found.");
  }

  if (error.code === "domain_not_usable") {
    return new ApiError("bad_request", 400, "The requested domain cannot be used.");
  }

  if (error.code === "invalid_lifecycle_transition") {
    return new ApiError("conflict", 409, "The identity cannot be changed in its current state.");
  }

  return new ApiError("bad_request", 400, "The identity request is invalid.");
}

export interface IdentityRouteDependencies {
  auth: AuthInstance;
  createIdentityUseCases: () => IdentityUseCases;
}

export function createIdentityRoutes({ auth, createIdentityUseCases }: IdentityRouteDependencies) {
  const routes = serverFactory.createApp();
  const service: IdentityService = createIdentityService({ createIdentityUseCases });

  routes.onError((error, c) => {
    return apiErrorHandler(toIdentityApiError(error) ?? error, c);
  });

  routes.use("*", requireSession(auth));

  routes.post(
    "/",
    zValidator("json", IdentityModel.createBody, (result) => {
      if (!result.success) {
        throw new ApiError("bad_request", 400, "The identity request is invalid.");
      }
    }),
    async (c) => {
      const identity = await service.createIdentity(c.var.user.id, c.req.valid("json"));
      return c.json({ identity: serializeIdentity(identity) }, 201);
    },
  );

  routes.get("/", async (c) => {
    const identities = await service.listIdentities(c.var.user.id);
    return c.json({ identities: identities.map(serializeIdentity) });
  });

  routes.get(
    "/:id",
    zValidator("param", IdentityModel.params, (result) => {
      if (!result.success) {
        throw new ApiError("bad_request", 400, "The identity id is invalid.");
      }
    }),
    async (c) => {
      const identity = await service.getIdentity(c.var.user.id, c.req.valid("param").id);
      return c.json({ identity: serializeIdentity(identity) });
    },
  );

  routes.patch(
    "/:id",
    zValidator("param", IdentityModel.params, (result) => {
      if (!result.success) {
        throw new ApiError("bad_request", 400, "The identity id is invalid.");
      }
    }),
    zValidator("json", IdentityModel.updateBody, (result) => {
      if (!result.success) {
        throw new ApiError("bad_request", 400, "The identity update is invalid.");
      }
    }),
    async (c) => {
      const identity = await service.updateIdentity(
        c.var.user.id,
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return c.json({ identity: serializeIdentity(identity) });
    },
  );

  routes.post(
    "/:id/torch",
    zValidator("param", IdentityModel.params, (result) => {
      if (!result.success) {
        throw new ApiError("bad_request", 400, "The identity id is invalid.");
      }
    }),
    async (c) => {
      const identity = await service.torchIdentity(c.var.user.id, c.req.valid("param").id);
      return c.json({ identity: serializeIdentity(identity) });
    },
  );

  return routes;
}
