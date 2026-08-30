import { describe, expect, test } from "bun:test";

import {
  InboundRoutingUseCases,
  type DestinationRecord,
  type DomainRecord,
  type IdentityDestinationRecord,
  type IdentityRecord,
  type IdentityRepository,
} from "../src";

const now = new Date("2026-08-30T12:00:00.000Z");

const identity: IdentityRecord = {
  id: "identity-1",
  userId: "user-1",
  domainId: "domain-1",
  localPart: "github-k7x2",
  address: "github-k7x2@example.com",
  label: "GitHub",
  status: "active",
  expiresAt: null,
  torchedAt: null,
  createdAt: now,
  updatedAt: now,
};

const domain: DomainRecord = {
  id: "domain-1",
  userId: "user-1",
  hostname: "example.com",
  status: "verified",
};

function createDestination(
  id: string,
  userId = "user-1",
  overrides: Partial<DestinationRecord> = {},
): DestinationRecord {
  return {
    id,
    userId,
    provider: "discord",
    label: "Discord",
    targetRef: "discord-target-1",
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRoutingUseCases({
  identityRecord = identity,
  domainRecord = domain,
  destinations = [createDestination("destination-1")],
  routes = [{ identityId: identity.id, destinationId: "destination-1", createdAt: now }],
}: {
  identityRecord?: IdentityRecord | null;
  domainRecord?: DomainRecord | null;
  destinations?: DestinationRecord[];
  routes?: IdentityDestinationRecord[];
} = {}) {
  const identityRepository: IdentityRepository = {
    findById: async () => null,
    findByAddress: async () => identityRecord,
    listByUserId: async () => [],
    create: async (record) => record,
    update: async (record) => record,
  };

  return new InboundRoutingUseCases({
    clock: { now: () => now },
    identityRepository,
    domainRepository: {
      findById: async () => domainRecord,
      listByUserId: async () => [],
    },
    destinationRepository: {
      findById: async () => null,
      listByUserId: async () => destinations,
      create: async (record) => record,
      update: async (record) => record,
    },
    identityDestinationRepository: {
      listByIdentityId: async () => routes,
      add: async (record) => record,
      remove: async () => undefined,
    },
  });
}

describe("InboundRoutingUseCases", () => {
  test("accepts a normalized recipient and returns only authorized selected destinations", async () => {
    const selected = createDestination("destination-1");
    const disabled = createDestination("destination-2", "user-1", { enabled: false });
    const foreign = createDestination("destination-3", "user-2");
    const useCases = createRoutingUseCases({
      destinations: [foreign, disabled, selected],
      routes: [
        { identityId: identity.id, destinationId: selected.id, createdAt: now },
        { identityId: identity.id, destinationId: disabled.id, createdAt: now },
        { identityId: identity.id, destinationId: foreign.id, createdAt: now },
      ],
    });

    const result = await useCases.route({ recipient: " GitHub-K7X2@EXAMPLE.COM " });

    expect(result).toEqual({ accepted: true, identity, destinations: [selected] });
  });

  test("rejects unknown and invalid recipients without throwing", async () => {
    const unknown = createRoutingUseCases({ identityRecord: null });

    expect(await unknown.route({ recipient: "missing@example.com" })).toEqual({
      accepted: false,
      reason: "identity_not_found",
    });
    expect(await unknown.route({ recipient: "not-an-email" })).toEqual({
      accepted: false,
      reason: "invalid_recipient",
    });
  });

  test("rejects expired and torched identities", async () => {
    const expired = createRoutingUseCases({
      identityRecord: { ...identity, expiresAt: new Date("2026-08-30T11:59:00.000Z") },
    });
    const torched = createRoutingUseCases({ identityRecord: { ...identity, status: "torched" } });

    expect(await expired.route({ recipient: identity.address })).toEqual({
      accepted: false,
      reason: "identity_expired",
    });
    expect(await torched.route({ recipient: identity.address })).toEqual({
      accepted: false,
      reason: "identity_torched",
    });
  });

  test("rejects unusable domains and identities without active destinations", async () => {
    const unverifiedDomain = createRoutingUseCases({
      domainRecord: { ...domain, status: "pending" },
    });
    const missingDomain = createRoutingUseCases({ domainRecord: null });
    const noDestinations = createRoutingUseCases({ destinations: [], routes: [] });

    expect(await unverifiedDomain.route({ recipient: identity.address })).toEqual({
      accepted: false,
      reason: "domain_not_usable",
    });
    expect(await missingDomain.route({ recipient: identity.address })).toEqual({
      accepted: false,
      reason: "domain_not_found",
    });
    expect(await noDestinations.route({ recipient: identity.address })).toEqual({
      accepted: false,
      reason: "no_destinations",
    });
  });
});
