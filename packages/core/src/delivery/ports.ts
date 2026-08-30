import type { DeliveryAttemptRecord } from "./types";

export interface DeliveryAttemptListOptions {
  limit?: number;
}

export interface DeliveryAttemptRepository {
  findByDeliveryKey(deliveryKey: string): Promise<DeliveryAttemptRecord | null>;
  findById(userId: string, id: string): Promise<DeliveryAttemptRecord | null>;
  listByUserId(
    userId: string,
    options?: DeliveryAttemptListOptions,
  ): Promise<DeliveryAttemptRecord[]>;
  create(attempt: DeliveryAttemptRecord): Promise<DeliveryAttemptRecord>;
  update(attempt: DeliveryAttemptRecord): Promise<DeliveryAttemptRecord>;
}
