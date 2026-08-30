import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export function createDbFromClient(client: Client) {
  return drizzle({ client, schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDbFromClient>;
