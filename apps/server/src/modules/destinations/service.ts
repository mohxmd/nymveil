import type { DestinationProvider, DestinationUseCases } from "@nymveil/core";

export interface DestinationServiceDependencies {
  createDestinationUseCases: () => DestinationUseCases;
}

export function createDestinationService({
  createDestinationUseCases,
}: DestinationServiceDependencies) {
  return {
    listDestinations(userId: string) {
      return createDestinationUseCases().listDestinations(userId);
    },

    updateDestination(userId: string, destinationId: string, enabled: boolean) {
      return createDestinationUseCases().updateDestination(userId, destinationId, { enabled });
    },

    listIdentityDestinations(userId: string, identityId: string) {
      return createDestinationUseCases().listIdentityDestinations(userId, identityId);
    },

    addIdentityDestination(userId: string, identityId: string, destinationId: string) {
      return createDestinationUseCases().addIdentityDestination(userId, identityId, destinationId);
    },

    removeIdentityDestination(userId: string, identityId: string, destinationId: string) {
      return createDestinationUseCases().removeIdentityDestination(
        userId,
        identityId,
        destinationId,
      );
    },
  };
}

export type DestinationService = ReturnType<typeof createDestinationService>;

export function serializeDestination(destination: {
  id: string;
  provider: DestinationProvider;
  label: string;
  enabled: boolean;
  targetRef: string | null;
}) {
  return {
    id: destination.id,
    provider: destination.provider,
    label: destination.label,
    enabled: destination.enabled,
    // A missing target reference means the provider is not connected. The
    // reference itself is intentionally never returned to the client.
    available: destination.provider === "dashboard" || destination.targetRef !== null,
  };
}
