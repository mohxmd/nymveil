import { ExpirationCleanup, IdentityUseCases } from "@nymveil/core";
import { createAuth } from "@nymveil/auth";
import {
  createDb,
  createDeliveryMetadataMaintenanceRepository,
  createDomainRepository,
  createIdentityMaintenanceRepository,
  createIdentityRepository,
} from "@nymveil/db";
import { env } from "@nymveil/env/server";
import { initLogger } from "evlog";

import { createApp } from "./app";
import { asScheduledCleanupJob, createScheduledCleanupHandler } from "./maintenance/cleanup";

initLogger({ env: { service: "nymveil-server" } });

const app = createApp({
  auth: createAuth(),
  corsOrigin: env.CORS_ORIGIN,
  createIdentityUseCases: () => {
    const db = createDb();

    return new IdentityUseCases({
      domainRepository: createDomainRepository(db),
      identityRepository: createIdentityRepository(db),
    });
  },
});

const scheduledCleanup = createScheduledCleanupHandler(
  asScheduledCleanupJob({
    run: () => {
      const db = createDb();
      const cleanup = new ExpirationCleanup({
        identityMaintenanceRepository: createIdentityMaintenanceRepository(db),
        deliveryMetadataMaintenanceRepository: createDeliveryMetadataMaintenanceRepository(db),
      });

      return cleanup.run();
    },
  }),
);

export default {
  fetch: app.fetch,
  scheduled: scheduledCleanup,
};
