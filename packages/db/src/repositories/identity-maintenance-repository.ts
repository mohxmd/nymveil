import { and, asc, eq, inArray, lte } from "drizzle-orm";

import type { IdentityMaintenanceRepository, IdentityRecord } from "@nymveil/core";

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

export function createIdentityMaintenanceRepository(db: Database): IdentityMaintenanceRepository {
  return {
    async listActiveExpiringBefore(before, limit) {
      const rows = await db
        .select(identitySelection)
        .from(identity)
        .where(and(eq(identity.status, "active"), lte(identity.expiresAt, before)))
        .orderBy(asc(identity.expiresAt), asc(identity.id))
        .limit(limit);

      return rows.map(mapIdentityRow);
    },

    async expire(identityId, now) {
      const rows = await db
        .update(identity)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(identity.id, identityId),
            eq(identity.status, "active"),
            lte(identity.expiresAt, now),
          ),
        )
        .returning({ id: identity.id });

      return rows.length > 0;
    },

    async deleteExpiredBefore(before, limit) {
      const rows = await db
        .select({ id: identity.id })
        .from(identity)
        .where(and(eq(identity.status, "expired"), lte(identity.expiresAt, before)))
        .orderBy(asc(identity.expiresAt), asc(identity.id))
        .limit(limit);
      const ids = rows.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      await db.delete(identity).where(inArray(identity.id, ids));
      return ids.length;
    },
  };
}
