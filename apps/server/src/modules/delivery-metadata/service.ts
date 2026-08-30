import type { DeliveryAttemptRecord, DeliveryMetadataUseCases } from "@nymveil/core";

export interface DeliveryMetadataServiceDependencies {
  createDeliveryMetadataUseCases: () => DeliveryMetadataUseCases;
}

export function createDeliveryMetadataService({
  createDeliveryMetadataUseCases,
}: DeliveryMetadataServiceDependencies) {
  return {
    listRecentAttempts(userId: string, limit: number) {
      return createDeliveryMetadataUseCases().listRecentAttempts(userId, limit);
    },
  };
}

export type DeliveryMetadataService = ReturnType<typeof createDeliveryMetadataService>;

export function serializeDeliveryAttempt(attempt: DeliveryAttemptRecord) {
  return {
    id: attempt.id,
    identityId: attempt.identityId,
    destinationId: attempt.destinationId,
    provider: attempt.provider,
    status: attempt.status,
    attemptedAt: attempt.attemptedAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString() ?? null,
    errorCode: attempt.errorCode,
  };
}
