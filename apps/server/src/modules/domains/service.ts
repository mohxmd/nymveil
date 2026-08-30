import type { DomainRepository } from "@nymveil/core";

export interface DomainServiceDependencies {
  domainRepository: DomainRepository;
}

export function createDomainService({ domainRepository }: DomainServiceDependencies) {
  return {
    listDomains(userId: string) {
      return domainRepository.listByUserId(userId);
    },
  };
}

export type DomainService = ReturnType<typeof createDomainService>;
