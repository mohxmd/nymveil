import { createClient } from "@libsql/client";
import { env } from "@nymveil/env/server";

import { createDbFromClient } from "./client";

export function createDb() {
  const client = createClient({
    url: env.DATABASE_URL || "",
    authToken: env.DATABASE_AUTH_TOKEN,
  });

  return createDbFromClient(client);
}

export { createDbFromClient } from "./client";
export type { Database } from "./client";

export { createDomainRepository } from "./repositories/domain-repository";
export { createIdentityRepository } from "./repositories/identity-repository";
