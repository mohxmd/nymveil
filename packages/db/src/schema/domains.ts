import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { id, timestamps } from "./_helpers";
import { user } from "./auth";
import { identity } from "./identities";

export const domainStatuses = ["pending", "verified", "revoked"] as const;
export type DomainStatus = (typeof domainStatuses)[number];

export const domain = sqliteTable(
  "domain",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hostname: text().notNull(),
    status: text().$type<DomainStatus>().notNull().default("pending"),
    verificationTokenHash: text(),
    verifiedAt: integer({ mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("uidx_domain_hostname").on(table.hostname),
    index("idx_domain_user_id").on(table.userId),
    index("idx_domain_status").on(table.status),
  ],
);

export const domainRelations = relations(domain, ({ one, many }) => ({
  owner: one(user, {
    fields: [domain.userId],
    references: [user.id],
  }),
  identities: many(identity),
}));
