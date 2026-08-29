import { and, desc, eq } from "drizzle-orm";

import {
  IdentityAddressConflictError,
  IdentityDomainError,
  type IdentityRecord,
  type IdentityRepository,
} from "@nymveil/core";

import type { Database } from "../client";
import { identity } from "../schema";

const identitySelection = {
  id: identity.id,
  userId: identity.userId,
  domainId: identity.domainId,
  localPart: identity.localPart,
  address: identity.address,
  label: identity.label,
  status: identity.status,
  expiresAt: identity.expiresAt,
  torchedAt: identity.torchedAt,
  createdAt: identity.createdAt,
  updatedAt: identity.updatedAt,
};

function mapIdentityRow(row: typeof identity.$inferSelect): IdentityRecord {
  return {
    id: row.id,
    userId: row.userId,
    domainId: row.domainId,
    localPart: row.localPart,
    address: row.address,
    label: row.label,
    status: row.status,
    expiresAt: row.expiresAt,
    torchedAt: row.torchedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isUniqueIdentityConstraint(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return message.includes("unique constraint") && message.includes("identity");
}

export function createIdentityRepository(db: Database): IdentityRepository {
  return {
    async findById(id) {
      const [row] = await db
        .select(identitySelection)
        .from(identity)
        .where(eq(identity.id, id))
        .limit(1);

      return row ? mapIdentityRow(row) : null;
    },

    async findByAddress(address) {
      const [row] = await db
        .select(identitySelection)
        .from(identity)
        .where(eq(identity.address, address))
        .limit(1);

      return row ? mapIdentityRow(row) : null;
    },

    async listByUserId(userId) {
      const rows = await db
        .select(identitySelection)
        .from(identity)
        .where(eq(identity.userId, userId))
        .orderBy(desc(identity.createdAt), desc(identity.id));

      return rows.map(mapIdentityRow);
    },

    async create(record) {
      try {
        const [row] = await db.insert(identity).values(record).returning(identitySelection);

        if (!row) {
          throw new IdentityDomainError("identity_not_found", "The identity was not created.");
        }

        return mapIdentityRow(row);
      } catch (error) {
        if (isUniqueIdentityConstraint(error)) {
          throw new IdentityAddressConflictError();
        }

        throw error;
      }
    },

    async update(record) {
      const [row] = await db
        .update(identity)
        .set({
          label: record.label,
          status: record.status,
          expiresAt: record.expiresAt,
          torchedAt: record.torchedAt,
          updatedAt: record.updatedAt,
        })
        .where(and(eq(identity.id, record.id), eq(identity.userId, record.userId)))
        .returning(identitySelection);

      if (!row) {
        throw new IdentityDomainError(
          "identity_not_found",
          "The requested identity was not found.",
        );
      }

      return mapIdentityRow(row);
    },
  };
}
