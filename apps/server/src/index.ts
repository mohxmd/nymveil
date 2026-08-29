import { IdentityUseCases } from "@nymveil/core";
import { createAuth } from "@nymveil/auth";
import { createDb, createDomainRepository, createIdentityRepository } from "@nymveil/db";
import { env } from "@nymveil/env/server";
import { initLogger } from "evlog";

import { createApp } from "./app";

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

export default app;
