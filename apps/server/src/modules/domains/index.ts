import { zValidator } from "@hono/zod-validator";
import { DomainDomainError, type DomainUseCases } from "@nymveil/core";

import { requireSession } from "../../http/auth-middleware";
import { ApiError, apiErrorHandler } from "../../http/errors";
import { serverFactory, type AuthInstance } from "../../http/types";
import { DomainModel } from "./model";
import {
  createDomainService,
  serializeDomain,
  type DomainService,
  verificationRecord,
} from "./service";

export interface DomainRouteDependencies {
  auth: AuthInstance;
  createDomainUseCases: () => DomainUseCases;
}

function toDomainApiError(error: unknown): ApiError | undefined {
  if (!(error instanceof DomainDomainError)) return undefined;

  if (error.code === "domain_not_found") {
    return new ApiError("not_found", 404, "The requested domain was not found.");
  }

  if (error.code === "domain_hostname_conflict") {
    return new ApiError("conflict", 409, "That domain is already registered.");
  }

  if (error.code === "domain_verification_unavailable") {
    return new ApiError(
      "service_unavailable",
      503,
      "Domain verification is temporarily unavailable.",
    );
  }

  if (error.code === "domain_verification_failed") {
    return new ApiError("conflict", 409, "The domain verification record was not found.");
  }

  if (error.code === "invalid_lifecycle_transition") {
    return new ApiError("conflict", 409, "The domain cannot be changed in its current state.");
  }

  return new ApiError("bad_request", 400, "The domain request is invalid.");
}

function rejectInvalidRequest(result: { success: boolean }, message: string) {
  if (!result.success) throw new ApiError("bad_request", 400, message);
}

export function createDomainRoutes({ auth, createDomainUseCases }: DomainRouteDependencies) {
  const routes = serverFactory.createApp();
  const service: DomainService = createDomainService({ createDomainUseCases });

  routes.onError((error, c) => apiErrorHandler(toDomainApiError(error) ?? error, c));

  routes.use("*", requireSession(auth));

  routes.post(
    "/",
    zValidator("json", DomainModel.createBody, (result) =>
      rejectInvalidRequest(result, "The domain request is invalid."),
    ),
    async (c) => {
      const result = await service.createDomain(c.var.user.id, c.req.valid("json").hostname);

      return c.json(
        DomainModel.provisioningResponse.parse({
          domain: serializeDomain(result.domain),
          verification: verificationRecord(result.domain.hostname, result.verificationToken),
        }),
        201,
      );
    },
  );

  routes.get("/", async (c) => {
    const domains = await service.listDomains(c.var.user.id);
    return c.json(
      DomainModel.listResponse.parse({
        domains: domains.map(serializeDomain),
      }),
    );
  });

  routes.post(
    "/:domainId/verification-token",
    zValidator("param", DomainModel.params, (result) =>
      rejectInvalidRequest(result, "The domain id is invalid."),
    ),
    async (c) => {
      const result = await service.rotateVerificationToken(
        c.var.user.id,
        c.req.valid("param").domainId,
      );

      return c.json(
        DomainModel.provisioningResponse.parse({
          domain: serializeDomain(result.domain),
          verification: verificationRecord(result.domain.hostname, result.verificationToken),
        }),
      );
    },
  );

  routes.post(
    "/:domainId/verify",
    zValidator("param", DomainModel.params, (result) =>
      rejectInvalidRequest(result, "The domain id is invalid."),
    ),
    zValidator("json", DomainModel.verifyBody, (result) =>
      rejectInvalidRequest(result, "The domain verification token is invalid."),
    ),
    async (c) => {
      const domain = await service.verifyDomain(
        c.var.user.id,
        c.req.valid("param").domainId,
        c.req.valid("json").verificationToken,
      );

      return c.json(DomainModel.response.parse({ domain: serializeDomain(domain) }));
    },
  );

  return routes;
}
