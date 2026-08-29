import type { IdentityRecord, IdentityUseCases } from "@nymveil/core";

import type { IdentityModel } from "./model";

export interface IdentityServiceDependencies {
  createIdentityUseCases: () => IdentityUseCases;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined || value === null ? value : new Date(value);
}

export function createIdentityService({ createIdentityUseCases }: IdentityServiceDependencies) {
  return {
    createIdentity(userId: string, input: IdentityModel["createBody"]) {
      return createIdentityUseCases().createIdentity({
        userId,
        domainId: input.domainId,
        label: input.label,
        expiresAt: toDate(input.expiresAt),
      });
    },

    listIdentities(userId: string) {
      return createIdentityUseCases().listIdentities(userId);
    },

    getIdentity(userId: string, identityId: string) {
      return createIdentityUseCases().getIdentity(userId, identityId);
    },

    updateIdentity(userId: string, identityId: string, input: IdentityModel["updateBody"]) {
      return createIdentityUseCases().updateIdentity(userId, identityId, {
        label: input.label,
        expiresAt: toDate(input.expiresAt),
      });
    },

    torchIdentity(userId: string, identityId: string) {
      return createIdentityUseCases().torchIdentity(userId, identityId);
    },
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;

export function serializeIdentity(identity: IdentityRecord) {
  return {
    id: identity.id,
    userId: identity.userId,
    domainId: identity.domainId,
    localPart: identity.localPart,
    address: identity.address,
    label: identity.label,
    status: identity.status,
    expiresAt: identity.expiresAt?.toISOString() ?? null,
    torchedAt: identity.torchedAt?.toISOString() ?? null,
    createdAt: identity.createdAt.toISOString(),
    updatedAt: identity.updatedAt.toISOString(),
  };
}
