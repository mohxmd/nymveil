import { and, eq } from "drizzle-orm";

import type { IdentityDestinationRecord, IdentityDestinationRepository } from "@nymveil/core";

import type { Database } from "../client";
import { identityDestination } from "../schema";

const identityDestinationSelection = {
  identityId: identityDestination.identityId,
  destinationId: identityDestination.destinationId,
  createdAt: identityDestination.createdAt,
};

export function createIdentityDestinationRepository(db: Database): IdentityDestinationRepository {
  return {
    async listByIdentityId(identityId) {
      const rows = await db
        .select(identityDestinationSelection)
        .from(identityDestination)
        .where(eq(identityDestination.identityId, identityId))
        .orderBy(identityDestination.createdAt, identityDestination.destinationId);

      return rows as IdentityDestinationRecord[];
    },

    async add(record) {
      const [row] = await db
        .insert(identityDestination)
        .values(record)
        .returning(identityDestinationSelection);

      if (!row) {
        throw new Error("The identity destination route was not created.");
      }

      return row;
    },

    async remove(identityId, destinationId) {
      await db
        .delete(identityDestination)
        .where(
          and(
            eq(identityDestination.identityId, identityId),
            eq(identityDestination.destinationId, destinationId),
          ),
        );
    },
  };
}
