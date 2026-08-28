import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "./_helpers";
import { user } from "./auth";
import { domain } from "./domains";
import { identityDestination } from "./identity-destinations";

export const identityStatuses = ["active", "expired", "torched"] as const;
export type IdentityStatus = (typeof identityStatuses)[number];

export const identity = sqliteTable(
  "identity",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    domainId: text()
      .notNull()
      .references(() => domain.id, { onDelete: "restrict" }),
    localPart: text().notNull(),
    address: text().notNull(),
    label: text().notNull(),
    status: text().$type<IdentityStatus>().notNull().default("active"),
    expiresAt: integer({ mode: "timestamp_ms" }),
    torchedAt: integer({ mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("uidx_identity_address").on(table.address),
    uniqueIndex("uidx_identity_domain_id_local_part").on(table.domainId, table.localPart),
    index("idx_identity_user_id").on(table.userId),
    index("idx_identity_domain_id").on(table.domainId),
    index("idx_identity_status_expires_at").on(table.status, table.expiresAt),
  ],
);

export const identityRelations = relations(identity, ({ one, many }) => ({
  owner: one(user, {
    fields: [identity.userId],
    references: [user.id],
  }),
  domain: one(domain, {
    fields: [identity.domainId],
    references: [domain.id],
  }),
  destinations: many(identityDestination),
}));
