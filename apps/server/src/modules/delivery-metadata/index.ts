import { zValidator } from "@hono/zod-validator";
import { DeliveryDomainError, type DeliveryMetadataUseCases } from "@nymveil/core";

import { requireSession } from "../../http/auth-middleware";
import { ApiError, apiErrorHandler } from "../../http/errors";
import { serverFactory, type AuthInstance } from "../../http/types";
import { DeliveryMetadataModel } from "./model";
import {
  createDeliveryMetadataService,
  serializeDeliveryAttempt,
  type DeliveryMetadataService,
} from "./service";

export interface DeliveryMetadataRouteDependencies {
  auth: AuthInstance;
  createDeliveryMetadataUseCases: () => DeliveryMetadataUseCases;
}

function toDeliveryMetadataApiError(error: unknown): ApiError | undefined {
  if (!(error instanceof DeliveryDomainError)) return undefined;

  return new ApiError("bad_request", 400, "The delivery metadata request is invalid.");
}

function rejectInvalidQuery(result: { success: boolean }) {
  if (!result.success) {
    throw new ApiError("bad_request", 400, "The delivery metadata query is invalid.");
  }
}

export function createDeliveryMetadataRoutes({
  auth,
  createDeliveryMetadataUseCases,
}: DeliveryMetadataRouteDependencies) {
  const routes = serverFactory.createApp();
  const service: DeliveryMetadataService = createDeliveryMetadataService({
    createDeliveryMetadataUseCases,
  });

  routes.onError((error, c) => {
    return apiErrorHandler(toDeliveryMetadataApiError(error) ?? error, c);
  });

  routes.use("*", requireSession(auth));

  routes.get(
    "/delivery-attempts",
    zValidator("query", DeliveryMetadataModel.query, (result) => rejectInvalidQuery(result)),
    async (c) => {
      const attempts = await service.listRecentAttempts(c.var.user.id, c.req.valid("query").limit);

      return c.json(
        DeliveryMetadataModel.listResponse.parse({
          attempts: attempts.map(serializeDeliveryAttempt),
        }),
      );
    },
  );

  return routes;
}
