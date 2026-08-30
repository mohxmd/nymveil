import { and, asc, inArray, lte } from "drizzle-orm";

import type { DeliveryMetadataMaintenanceRepository } from "@nymveil/core";

import type { Database } from "../client";
import { deliveryAttempt } from "../schema";

export function createDeliveryMetadataMaintenanceRepository(
  db: Database,
): DeliveryMetadataMaintenanceRepository {
  return {
    async deleteCompletedBefore(before, limit) {
      const rows = await db
        .select({ id: deliveryAttempt.id })
        .from(deliveryAttempt)
        .where(
          and(
            inArray(deliveryAttempt.status, ["succeeded", "failed"]),
            lte(deliveryAttempt.completedAt, before),
          ),
        )
        .orderBy(asc(deliveryAttempt.completedAt), asc(deliveryAttempt.id))
        .limit(limit);
      const ids = rows.map((row) => row.id);

      if (ids.length === 0) {
        return 0;
      }

      await db.delete(deliveryAttempt).where(inArray(deliveryAttempt.id, ids));
      return ids.length;
    },
  };
}
