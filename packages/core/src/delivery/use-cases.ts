import { DeliveryDomainError } from "./errors";
import type { DeliveryAttemptRepository } from "./ports";
import type { DeliveryAttemptRecord } from "./types";

export const DEFAULT_DELIVERY_ATTEMPT_LIMIT = 50;
export const MAX_DELIVERY_ATTEMPT_LIMIT = 100;

export interface DeliveryMetadataUseCaseDependencies {
  deliveryAttemptRepository: DeliveryAttemptRepository;
}

export class DeliveryMetadataUseCases {
  constructor(private readonly dependencies: DeliveryMetadataUseCaseDependencies) {}

  async listRecentAttempts(
    userId: string,
    limit = DEFAULT_DELIVERY_ATTEMPT_LIMIT,
  ): Promise<DeliveryAttemptRecord[]> {
    const ownerId = userId.trim();

    if (!ownerId) {
      throw new DeliveryDomainError("invalid_input", "userId is required.");
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DELIVERY_ATTEMPT_LIMIT) {
      throw new DeliveryDomainError("invalid_input", "The delivery attempt limit is invalid.");
    }

    return this.dependencies.deliveryAttemptRepository.listByUserId(ownerId, { limit });
  }
}
