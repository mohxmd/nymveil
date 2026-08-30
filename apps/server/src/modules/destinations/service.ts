import type { DestinationProvider, DestinationUseCases } from "@nymveil/core";

import type { DestinationModel } from "./model";
import { DestinationConfigurationError } from "../../delivery/errors";
import type { DestinationCredentialStore } from "./ports";

export interface DestinationServiceDependencies {
  createDestinationUseCases: () => DestinationUseCases;
  credentials?: DestinationCredentialStore;
}

export function createDestinationService({
  createDestinationUseCases,
  credentials,
}: DestinationServiceDependencies) {
  return {
    async createDestination(userId: string, input: DestinationModel["createBody"]) {
      if (input.provider !== "dashboard" && !credentials) {
        throw new DestinationConfigurationError();
      }

      const destination = await createDestinationUseCases().createDestination(userId, {
        provider: input.provider,
        label: input.label,
        targetRef: input.targetRef,
      });

      try {
        if (credentials) {
          await credentials.save(destination.id, input.config);
        }
      } catch (error) {
        await createDestinationUseCases().deleteDestination(userId, destination.id);
        throw error;
      }

      return destination;
    },

    listDestinations(userId: string) {
      return createDestinationUseCases().listDestinations(userId);
    },

    updateDestination(
      userId: string,
      destinationId: string,
      input: DestinationModel["updateBody"],
    ) {
      return createDestinationUseCases().updateDestination(userId, destinationId, input);
    },

    async deleteDestination(userId: string, destinationId: string) {
      await createDestinationUseCases().deleteDestination(userId, destinationId);
      await credentials?.delete(destinationId);
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
