import { createAuth } from "@nymveil/auth";
import { env } from "@nymveil/env/server";
import { initLogger } from "evlog";

import { createApp } from "./app";

initLogger({ env: { service: "nymveil-server" } });

const app = createApp({
  auth: createAuth(),
  corsOrigin: env.CORS_ORIGIN,
});

export default app;
