import type { DomainRecord, DomainUseCases } from "@nymveil/core";

export interface DomainServiceDependencies {
  createDomainUseCases: () => DomainUseCases;
}

export function createDomainService({ createDomainUseCases }: DomainServiceDependencies) {
  return {
    listDomains(userId: string) {
      return createDomainUseCases().listDomains(userId);
    },

    createDomain(userId: string, hostname: string) {
      return createDomainUseCases().createDomain({ userId, hostname });
    },

    rotateVerificationToken(userId: string, domainId: string) {
      return createDomainUseCases().rotateVerificationToken(userId, domainId);
    },

    verifyDomain(userId: string, domainId: string, verificationToken: string) {
      return createDomainUseCases().verifyDomain(userId, domainId, verificationToken);
    },
  };
}

export type DomainService = ReturnType<typeof createDomainService>;

export function serializeDomain(domain: DomainRecord) {
  return {
    id: domain.id,
    userId: domain.userId,
    hostname: domain.hostname,
    status: domain.status,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}

export function verificationRecord(hostname: string, token: string) {
  return {
    type: "TXT" as const,
    name: `_nymveil-challenge.${hostname}`,
    value: token,
  };
}
