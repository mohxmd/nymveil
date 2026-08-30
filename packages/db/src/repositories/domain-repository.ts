import { and, asc, eq } from "drizzle-orm";

import {
  DomainHostnameConflictError,
  type DomainManagementRepository,
  type DomainRecord,
} from "@nymveil/core";

import type { Database } from "../client";
import { domain } from "../schema";

const domainSelection = {
  id: domain.id,
  userId: domain.userId,
  hostname: domain.hostname,
  status: domain.status,
  verificationTokenHash: domain.verificationTokenHash,
  verifiedAt: domain.verifiedAt,
  createdAt: domain.createdAt,
  updatedAt: domain.updatedAt,
};

function mapDomainRow(row: typeof domain.$inferSelect): DomainRecord {
  return {
    id: row.id,
    userId: row.userId,
    hostname: row.hostname,
    status: row.status,
    verificationTokenHash: row.verificationTokenHash,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isHostnameConflict(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes("domain.hostname")) return true;
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? current.cause
        : undefined;
  }

  return false;
}

export function createDomainRepository(db: Database): DomainManagementRepository {
  return {
    async findById(id) {
      const [row] = await db.select(domainSelection).from(domain).where(eq(domain.id, id)).limit(1);

      return row ? mapDomainRow(row) : null;
    },

    async findByHostname(hostname) {
      const [row] = await db
        .select(domainSelection)
        .from(domain)
        .where(eq(domain.hostname, hostname))
        .limit(1);

      return row ? mapDomainRow(row) : null;
    },

    async listByUserId(userId) {
      const rows = await db
        .select(domainSelection)
        .from(domain)
        .where(eq(domain.userId, userId))
        .orderBy(asc(domain.hostname), asc(domain.id));

      return rows.map(mapDomainRow);
    },

    async create(record) {
      try {
        const [row] = await db.insert(domain).values(record).returning(domainSelection);

        if (!row) throw new Error("The domain was not created.");
        return mapDomainRow(row);
      } catch (error) {
        if (isHostnameConflict(error)) throw new DomainHostnameConflictError();
        throw error;
      }
    },

    async update(record) {
      const [row] = await db
        .update(domain)
        .set({
          hostname: record.hostname,
          status: record.status,
          verificationTokenHash: record.verificationTokenHash,
          verifiedAt: record.verifiedAt,
          updatedAt: record.updatedAt,
        })
        .where(and(eq(domain.id, record.id), eq(domain.userId, record.userId)))
        .returning(domainSelection);

      if (!row) throw new Error("The domain was not found.");
      return mapDomainRow(row);
    },
  };
}
