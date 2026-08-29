import { and, desc, eq } from "drizzle-orm";

import {
  DeliveryDomainError,
  DeliveryKeyConflictError,
  type DeliveryAttemptRecord,
  type DeliveryAttemptRepository,
} from "@nymveil/core";

import type { Database } from "../client";
import { deliveryAttempt } from "../schema";

const deliveryAttemptSelection = {
  id: deliveryAttempt.id,
  deliveryKey: deliveryAttempt.deliveryKey,
  userId: deliveryAttempt.userId,
  identityId: deliveryAttempt.identityId,
  destinationId: deliveryAttempt.destinationId,
  provider: deliveryAttempt.provider,
  status: deliveryAttempt.status,
  attemptedAt: deliveryAttempt.attemptedAt,
  completedAt: deliveryAttempt.completedAt,
  errorCode: deliveryAttempt.errorCode,
  createdAt: deliveryAttempt.createdAt,
  updatedAt: deliveryAttempt.updatedAt,
};

function mapDeliveryAttemptRow(row: typeof deliveryAttempt.$inferSelect): DeliveryAttemptRecord {
  return {
    id: row.id,
    deliveryKey: row.deliveryKey,
    userId: row.userId,
    identityId: row.identityId,
    destinationId: row.destinationId,
    provider: row.provider,
    status: row.status,
    attemptedAt: row.attemptedAt,
    completedAt: row.completedAt,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isDeliveryKeyConflict(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("unique constraint") && message.includes("delivery_attempt")) {
      return true;
    }

    if ("cause" in error) {
      return isDeliveryKeyConflict(error.cause);
    }
  }

  return false;
}

export function createDeliveryAttemptRepository(db: Database): DeliveryAttemptRepository {
  return {
    async findByDeliveryKey(deliveryKey) {
      const [row] = await db
        .select(deliveryAttemptSelection)
        .from(deliveryAttempt)
        .where(eq(deliveryAttempt.deliveryKey, deliveryKey))
        .limit(1);

      return row ? mapDeliveryAttemptRow(row) : null;
    },

    async findById(userId, id) {
      const [row] = await db
        .select(deliveryAttemptSelection)
        .from(deliveryAttempt)
        .where(and(eq(deliveryAttempt.id, id), eq(deliveryAttempt.userId, userId)))
        .limit(1);

      return row ? mapDeliveryAttemptRow(row) : null;
    },

    async listByUserId(userId) {
      const rows = await db
        .select(deliveryAttemptSelection)
        .from(deliveryAttempt)
        .where(eq(deliveryAttempt.userId, userId))
        .orderBy(desc(deliveryAttempt.createdAt), desc(deliveryAttempt.id));

      return rows.map(mapDeliveryAttemptRow);
    },

    async create(record) {
      try {
        const [row] = await db
          .insert(deliveryAttempt)
          .values(record)
          .returning(deliveryAttemptSelection);

        if (!row) {
          throw new DeliveryDomainError(
            "delivery_not_found",
            "The delivery attempt was not created.",
          );
        }

        return mapDeliveryAttemptRow(row);
      } catch (error) {
        if (isDeliveryKeyConflict(error)) {
          throw new DeliveryKeyConflictError();
        }

        throw error;
      }
    },

    async update(record) {
      const [row] = await db
        .update(deliveryAttempt)
        .set({
          status: record.status,
          attemptedAt: record.attemptedAt,
          completedAt: record.completedAt,
          errorCode: record.errorCode,
          updatedAt: record.updatedAt,
        })
        .where(and(eq(deliveryAttempt.id, record.id), eq(deliveryAttempt.userId, record.userId)))
        .returning(deliveryAttemptSelection);

      if (!row) {
        throw new DeliveryDomainError("delivery_not_found", "The delivery attempt was not found.");
      }

      return mapDeliveryAttemptRow(row);
    },
  };
}
