import { and, eq } from "drizzle-orm";

import type { DestinationRecord, DestinationRepository } from "@nymveil/core";

import type { Database } from "../client";
import { destination } from "../schema";

const destinationSelection = {
  id: destination.id,
  userId: destination.userId,
  provider: destination.provider,
  label: destination.label,
  targetRef: destination.targetRef,
  enabled: destination.enabled,
  createdAt: destination.createdAt,
  updatedAt: destination.updatedAt,
};

function mapDestinationRow(row: typeof destination.$inferSelect): DestinationRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    label: row.label,
    targetRef: row.targetRef,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDestinationRepository(db: Database): DestinationRepository {
  return {
    async findById(id) {
      const [row] = await db
        .select(destinationSelection)
        .from(destination)
        .where(eq(destination.id, id))
        .limit(1);

      return row ? mapDestinationRow(row) : null;
    },

    async listByUserId(userId) {
      const rows = await db
        .select(destinationSelection)
        .from(destination)
        .where(eq(destination.userId, userId))
        .orderBy(destination.createdAt, destination.id);

      return rows.map(mapDestinationRow);
    },

    async create(record) {
      const [row] = await db.insert(destination).values(record).returning(destinationSelection);

      if (!row) {
        throw new Error("The destination was not created.");
      }

      return mapDestinationRow(row);
    },

    async update(record) {
      const [row] = await db
        .update(destination)
        .set({
          label: record.label,
          targetRef: record.targetRef,
          enabled: record.enabled,
          updatedAt: record.updatedAt,
        })
        .where(and(eq(destination.id, record.id), eq(destination.userId, record.userId)))
        .returning(destinationSelection);

      if (!row) {
        throw new Error("The destination was not found.");
      }

      return mapDestinationRow(row);
    },
  };
}
