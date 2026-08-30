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
export { createDeliveryAttemptRepository } from "./repositories/delivery-attempt-repository";
export { createDeliveryMetadataMaintenanceRepository } from "./repositories/delivery-metadata-maintenance-repository";
export { createDestinationRepository } from "./repositories/destination-repository";
export { createIdentityRepository } from "./repositories/identity-repository";
export { createIdentityDestinationRepository } from "./repositories/identity-destination-repository";
export { createIdentityMaintenanceRepository } from "./repositories/identity-maintenance-repository";
