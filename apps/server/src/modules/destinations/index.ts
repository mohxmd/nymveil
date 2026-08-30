import { DestinationDomainError, type DestinationUseCases } from "@nymveil/core";
import { zValidator } from "@hono/zod-validator";

import { requireSession } from "../../http/auth-middleware";
import { ApiError, apiErrorHandler } from "../../http/errors";
import { serverFactory, type AuthInstance } from "../../http/types";
import { DestinationModel } from "./model";
import { createDestinationService, serializeDestination, type DestinationService } from "./service";
import { DestinationConfigurationError } from "../../delivery/errors";
import type { DestinationCredentialStore } from "./ports";

function toDestinationApiError(error: unknown): ApiError | undefined {
  if (error instanceof DestinationConfigurationError) {
    return new ApiError(
      "service_unavailable",
      503,
      "Destination configuration is temporarily unavailable.",
    );
  }

  if (!(error instanceof DestinationDomainError)) return undefined;

  if (error.code === "destination_not_found" || error.code === "identity_not_found") {
    return new ApiError("not_found", 404, "The requested resource was not found.");
  }

  if (error.code === "invalid_lifecycle_transition") {
    return new ApiError(
      "conflict",
      409,
      "The identity cannot change its destinations in its current state.",
    );
  }

  return new ApiError("bad_request", 400, "The destination request is invalid.");
}

export interface DestinationRouteDependencies {
  auth: AuthInstance;
  createDestinationUseCases: () => DestinationUseCases;
  credentials?: DestinationCredentialStore;
}

function rejectInvalidRequest(result: { success: boolean }, message: string) {
  if (!result.success) {
    throw new ApiError("bad_request", 400, message);
  }
}

export function createDestinationRoutes({
  auth,
  createDestinationUseCases,
  credentials,
}: DestinationRouteDependencies) {
  const routes = serverFactory.createApp();
  const service: DestinationService = createDestinationService({
    createDestinationUseCases,
    credentials,
  });

  routes.onError((error, c) => {
    return apiErrorHandler(toDestinationApiError(error) ?? error, c);
  });

  routes.use("*", requireSession(auth));

  routes.get("/destinations", async (c) => {
    const destinations = await service.listDestinations(c.var.user.id);

    return c.json(
      DestinationModel.listResponse.parse({
        destinations: destinations.map(serializeDestination),
      }),
    );
  });

  routes.post(
    "/destinations",
    zValidator("json", DestinationModel.createBody, (result) =>
      rejectInvalidRequest(result, "The destination request is invalid."),
    ),
    async (c) => {
      const destination = await service.createDestination(c.var.user.id, c.req.valid("json"));

      return c.json({ destination: serializeDestination(destination) }, 201);
    },
  );

  routes.patch(
    "/destinations/:destinationId",
    zValidator("param", DestinationModel.params, (result) =>
      rejectInvalidRequest(result, "The destination id is invalid."),
    ),
    zValidator("json", DestinationModel.updateBody, (result) =>
      rejectInvalidRequest(result, "The destination update is invalid."),
    ),
    async (c) => {
      const destination = await service.updateDestination(
        c.var.user.id,
        c.req.valid("param").destinationId,
        c.req.valid("json"),
      );

      return c.json({ destination: serializeDestination(destination) });
    },
  );

  routes.delete(
    "/destinations/:destinationId",
    zValidator("param", DestinationModel.params, (result) =>
      rejectInvalidRequest(result, "The destination id is invalid."),
    ),
    async (c) => {
      await service.deleteDestination(c.var.user.id, c.req.valid("param").destinationId);

      return c.json(DestinationModel.routeResponse.parse({ ok: true }));
    },
  );

  routes.get(
    "/identities/:identityId/destinations",
    zValidator("param", DestinationModel.identityParams, (result) =>
      rejectInvalidRequest(result, "The identity id is invalid."),
    ),
    async (c) => {
      const destinations = await service.listIdentityDestinations(
        c.var.user.id,
        c.req.valid("param").identityId,
      );

      return c.json(
        DestinationModel.identityListResponse.parse({
          destinations: destinations.map(({ destination, selected }) => ({
            ...serializeDestination(destination),
            selected,
          })),
        }),
      );
    },
  );

  routes.put(
    "/identities/:identityId/destinations/:destinationId",
    zValidator("param", DestinationModel.identityParams.merge(DestinationModel.params), (result) =>
      rejectInvalidRequest(result, "The identity route ids are invalid."),
    ),
    async (c) => {
      await service.addIdentityDestination(
        c.var.user.id,
        c.req.valid("param").identityId,
        c.req.valid("param").destinationId,
      );

      return c.json(DestinationModel.routeResponse.parse({ ok: true }));
    },
  );

  routes.delete(
    "/identities/:identityId/destinations/:destinationId",
    zValidator("param", DestinationModel.identityParams.merge(DestinationModel.params), (result) =>
      rejectInvalidRequest(result, "The identity route ids are invalid."),
    ),
    async (c) => {
      await service.removeIdentityDestination(
        c.var.user.id,
        c.req.valid("param").identityId,
        c.req.valid("param").destinationId,
      );

      return c.json(DestinationModel.routeResponse.parse({ ok: true }));
    },
  );

  return routes;
}
