import type { IdentityRecord } from "../identity/types";

export interface IdentityMaintenanceRepository {
  listActiveExpiringBefore(before: Date, limit: number): Promise<IdentityRecord[]>;
  expire(identityId: string, now: Date): Promise<boolean>;
  deleteExpiredBefore(before: Date, limit: number): Promise<number>;
}

export interface DeliveryMetadataMaintenanceRepository {
  deleteCompletedBefore(before: Date, limit: number): Promise<number>;
}
