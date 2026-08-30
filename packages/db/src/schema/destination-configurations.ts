import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./_helpers";
import { destination } from "./destinations";

/**
 * Encrypted provider configuration for a destination.
 *
 * The application owns encryption and decryption. These columns must never be
 * returned by an API or included in delivery metadata.
 */
export const destinationConfiguration = sqliteTable("destination_configuration", {
  destinationId: text()
    .primaryKey()
    .references(() => destination.id, { onDelete: "cascade" }),
  ciphertext: text().notNull(),
  nonce: text().notNull(),
  ...timestamps(),
});
