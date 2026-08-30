import { requireSession } from "../../http/auth-middleware";
import { serverFactory, type AuthInstance } from "../../http/types";
import type { DomainRepository } from "@nymveil/core";

import { DomainModel } from "./model";
import { createDomainService, type DomainService } from "./service";

export interface DomainRouteDependencies {
  auth: AuthInstance;
  domainRepository: DomainRepository;
}

export function createDomainRoutes({ auth, domainRepository }: DomainRouteDependencies) {
  const routes = serverFactory.createApp();
  const service: DomainService = createDomainService({ domainRepository });

  routes.use("*", requireSession(auth));

  routes.get("/", async (c) => {
    const domains = await service.listDomains(c.var.user.id);
    return c.json(
      DomainModel.listResponse.parse({
        domains: domains.map((domain) => ({
          id: domain.id,
          userId: domain.userId,
          hostname: domain.hostname,
          status: domain.status,
        })),
      }),
    );
  });

  return routes;
}
