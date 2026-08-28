import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { destination } from "./destinations";
import { identity } from "./identities";

export const identityDestination = sqliteTable(
  "identity_destination",
  {
    identityId: text()
      .notNull()
      .references(() => identity.id, { onDelete: "cascade" }),
    destinationId: text()
      .notNull()
      .references(() => destination.id, { onDelete: "cascade" }),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsecond') * 1000)`),
  },
  (table) => [
    primaryKey({
      columns: [table.identityId, table.destinationId],
      name: "pk_identity_destination",
    }),
  ],
);

export const identityDestinationRelations = relations(identityDestination, ({ one }) => ({
  identity: one(identity, {
    fields: [identityDestination.identityId],
    references: [identity.id],
  }),
  destination: one(destination, {
    fields: [identityDestination.destinationId],
    references: [destination.id],
  }),
}));
