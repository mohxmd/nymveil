import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type {
  DeliveryAttemptStatus,
  DeliveryFailureCode,
  DestinationProvider,
} from "@nymveil/core";

import { id, timestamps } from "./_helpers";
import { destination } from "./destinations";
import { identity } from "./identities";
import { user } from "./auth";

export const deliveryAttemptStatuses = ["pending", "succeeded", "failed"] as const;

export const deliveryAttempt = sqliteTable(
  "delivery_attempt",
  {
    id: id(),
    deliveryKey: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    identityId: text()
      .notNull()
      .references(() => identity.id, { onDelete: "cascade" }),
    destinationId: text()
      .notNull()
      .references(() => destination.id, { onDelete: "cascade" }),
    provider: text().$type<DestinationProvider>().notNull(),
    status: text().$type<DeliveryAttemptStatus>().notNull().default("pending"),
    attemptedAt: integer({ mode: "timestamp_ms" }).notNull(),
    completedAt: integer({ mode: "timestamp_ms" }),
    errorCode: text().$type<DeliveryFailureCode>(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("uidx_delivery_attempt_delivery_key").on(table.deliveryKey),
    index("idx_delivery_attempt_user_id_created_at").on(table.userId, table.createdAt),
    index("idx_delivery_attempt_identity_id").on(table.identityId),
    index("idx_delivery_attempt_destination_id").on(table.destinationId),
    index("idx_delivery_attempt_status").on(table.status),
  ],
);

export const deliveryAttemptRelations = relations(deliveryAttempt, ({ one }) => ({
  owner: one(user, {
    fields: [deliveryAttempt.userId],
    references: [user.id],
  }),
  identity: one(identity, {
    fields: [deliveryAttempt.identityId],
    references: [identity.id],
  }),
  destination: one(destination, {
    fields: [deliveryAttempt.destinationId],
    references: [destination.id],
  }),
}));
