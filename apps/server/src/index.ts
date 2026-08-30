import { DestinationUseCases, ExpirationCleanup, IdentityUseCases } from "@nymveil/core";
import { createAuth } from "@nymveil/auth";
import {
  createDb,
  createDeliveryMetadataMaintenanceRepository,
  createDestinationRepository,
  createDomainRepository,
  createIdentityDestinationRepository,
  createIdentityMaintenanceRepository,
  createIdentityRepository,
} from "@nymveil/db";
import { env } from "@nymveil/env/server";
import { initLogger } from "evlog";

import { createApp } from "./app";
import { asScheduledCleanupJob, createScheduledCleanupHandler } from "./maintenance/cleanup";

initLogger({ env: { service: "nymveil-server" } });

const db = createDb();

const app = createApp({
  auth: createAuth(),
  corsOrigin: env.CORS_ORIGIN,
  createDomainRepository: () => createDomainRepository(db),
  createIdentityUseCases: () => {
    return new IdentityUseCases({
      domainRepository: createDomainRepository(db),
      identityRepository: createIdentityRepository(db),
    });
  },
  createDestinationUseCases: () =>
    new DestinationUseCases({
      destinationRepository: createDestinationRepository(db),
      identityDestinationRepository: createIdentityDestinationRepository(db),
      identityRepository: createIdentityRepository(db),
    }),
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
