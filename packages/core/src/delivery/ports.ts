import type { DeliveryAttemptRecord } from "./types";

export interface DeliveryAttemptRepository {
  findByDeliveryKey(deliveryKey: string): Promise<DeliveryAttemptRecord | null>;
  findById(userId: string, id: string): Promise<DeliveryAttemptRecord | null>;
  listByUserId(userId: string): Promise<DeliveryAttemptRecord[]>;
  create(attempt: DeliveryAttemptRecord): Promise<DeliveryAttemptRecord>;
  update(attempt: DeliveryAttemptRecord): Promise<DeliveryAttemptRecord>;
}
