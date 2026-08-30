import { asc, eq } from "drizzle-orm";

import type { DomainRepository } from "@nymveil/core";

import type { Database } from "../client";
import { domain } from "../schema";

const domainSelection = {
  id: domain.id,
  userId: domain.userId,
  hostname: domain.hostname,
  status: domain.status,
};

export function createDomainRepository(db: Database): DomainRepository {
  return {
    async findById(id) {
      const [row] = await db.select(domainSelection).from(domain).where(eq(domain.id, id)).limit(1);

      return row ?? null;
    },

    async listByUserId(userId) {
      const rows = await db
        .select(domainSelection)
        .from(domain)
        .where(eq(domain.userId, userId))
        .orderBy(asc(domain.hostname), asc(domain.id));

      return rows;
    },
  };
}
