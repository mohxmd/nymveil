import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "./_helpers";
import { user } from "./auth";
import { identityDestination } from "./identity-destinations";

export const destinationProviders = ["discord", "telegram"] as const;
export type DestinationProvider = (typeof destinationProviders)[number];

export const destination = sqliteTable(
  "destination",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text().$type<DestinationProvider>().notNull(),
    label: text().notNull(),
    configRef: text().notNull(),
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    ...timestamps(),
  },
  (table) => [index("idx_destination_user_id").on(table.userId)],
);

export const destinationRelations = relations(destination, ({ one, many }) => ({
  owner: one(user, {
    fields: [destination.userId],
    references: [user.id],
  }),
  identities: many(identityDestination),
}));
