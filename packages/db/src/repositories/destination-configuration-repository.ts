import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { destinationConfiguration } from "../schema";

export interface DestinationConfigurationRecord {
  destinationId: string;
  ciphertext: string;
  nonce: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DestinationConfigurationRepository {
  findByDestinationId(destinationId: string): Promise<DestinationConfigurationRecord | null>;
  upsert(
    record: Omit<DestinationConfigurationRecord, "createdAt" | "updatedAt"> & {
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Promise<DestinationConfigurationRecord>;
  delete(destinationId: string): Promise<void>;
}

function mapRow(row: typeof destinationConfiguration.$inferSelect): DestinationConfigurationRecord {
  return {
    destinationId: row.destinationId,
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createDestinationConfigurationRepository(
  db: Database,
): DestinationConfigurationRepository {
  return {
    async findByDestinationId(destinationId) {
      const [row] = await db
        .select()
        .from(destinationConfiguration)
        .where(eq(destinationConfiguration.destinationId, destinationId))
        .limit(1);

      return row ? mapRow(row) : null;
    },

    async upsert(record) {
      const now = new Date();
      const values = {
        destinationId: record.destinationId,
        ciphertext: record.ciphertext,
        nonce: record.nonce,
        createdAt: record.createdAt ?? now,
        updatedAt: record.updatedAt ?? now,
      };
      const [row] = await db
        .insert(destinationConfiguration)
        .values(values)
        .onConflictDoUpdate({
          target: destinationConfiguration.destinationId,
          set: {
            ciphertext: values.ciphertext,
            nonce: values.nonce,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      if (!row) {
        throw new Error("The destination configuration was not saved.");
      }

      return mapRow(row);
    },

    async delete(destinationId) {
      await db
        .delete(destinationConfiguration)
        .where(eq(destinationConfiguration.destinationId, destinationId));
    },
  };
}
