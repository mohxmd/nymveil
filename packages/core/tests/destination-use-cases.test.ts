import { describe, expect, test } from "bun:test";

import {
  DestinationDomainError,
  DestinationUseCases,
  type DestinationRecord,
  type DestinationRepository,
  type IdentityDestinationRecord,
  type IdentityDestinationRepository,
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

const destinations: DestinationRecord[] = [
  {
    id: "destination-1",
    userId: "user-1",
    provider: "discord",
    label: "Discord",
    targetRef: "discord-target-1",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "destination-2",
    userId: "user-1",
    provider: "telegram",
    label: "Telegram",
    targetRef: null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  },
];

function createContext(initialRoutes: IdentityDestinationRecord[] = []) {
  const routeRecords = [...initialRoutes];
  const destinationRecords = destinations.map((destination) => ({ ...destination }));
  const destinationRepository: DestinationRepository = {
    findById: async (id) => destinationRecords.find((destination) => destination.id === id) ?? null,
    listByUserId: async (userId) =>
      destinationRecords.filter((destination) => destination.userId === userId),
    create: async (destination) => destination,
    update: async (destination) => {
      const index = destinationRecords.findIndex((candidate) => candidate.id === destination.id);
      destinationRecords[index] = destination;
      return destination;
    },
    delete: async (userId, id) => {
      const index = destinationRecords.findIndex(
        (destination) => destination.id === id && destination.userId === userId,
      );
      if (index !== -1) destinationRecords.splice(index, 1);
    },
  };
  const identityDestinationRepository: IdentityDestinationRepository = {
    listByIdentityId: async (identityId) =>
      routeRecords.filter((route) => route.identityId === identityId),
    add: async (route) => {
      routeRecords.push(route);
      return route;
    },
    remove: async (identityId, destinationId) => {
      const index = routeRecords.findIndex(
        (route) => route.identityId === identityId && route.destinationId === destinationId,
      );
      if (index !== -1) routeRecords.splice(index, 1);
    },
  };
  const identityRepository: IdentityRepository = {
    findById: async (id) => (id === identity.id ? identity : null),
    findByAddress: async () => null,
    listByUserId: async () => [identity],
    create: async (record) => record,
    update: async (record) => record,
  };

  return {
    routes: routeRecords,
    useCases: new DestinationUseCases({
      clock: { now: () => now },
      destinationRepository,
      identityDestinationRepository,
      identityRepository,
    }),
  };
}

describe("DestinationUseCases", () => {
  test("lists owned destinations without exposing provider references", async () => {
    const { useCases } = createContext();

    expect(await useCases.listDestinations("user-1")).toEqual(destinations);
  });

  test("updates only an owned destination", async () => {
    const { useCases } = createContext();

    const updated = await useCases.updateDestination("user-1", "destination-1", {
      enabled: false,
    });

    expect(updated.enabled).toBe(false);
    await expect(
      useCases.updateDestination("user-2", "destination-1", { enabled: true }),
    ).rejects.toMatchObject<Partial<DestinationDomainError>>({ code: "destination_not_found" });
  });

  test("creates validated destinations and deletes only owned records", async () => {
    const { useCases } = createContext();

    const created = await useCases.createDestination("user-1", {
      provider: "dashboard",
      label: "  Dashboard  ",
    });

    expect(created).toMatchObject({
      userId: "user-1",
      provider: "dashboard",
      label: "Dashboard",
      targetRef: null,
      enabled: true,
    });

    await expect(
      useCases.createDestination("user-1", {
        provider: "discord",
        label: "Discord",
      }),
    ).rejects.toMatchObject<Partial<DestinationDomainError>>({ code: "invalid_input" });

    await useCases.deleteDestination("user-1", "destination-1");
    await expect(useCases.listDestinations("user-1")).resolves.toHaveLength(1);
  });

  test("manages identity routes idempotently and enforces ownership", async () => {
    const { useCases, routes } = createContext();

    await useCases.addIdentityDestination("user-1", identity.id, "destination-1");
    await useCases.addIdentityDestination("user-1", identity.id, "destination-1");

    expect(routes).toHaveLength(1);
    expect(await useCases.listIdentityDestinations("user-1", identity.id)).toEqual([
      { destination: destinations[0], selected: true },
      { destination: destinations[1], selected: false },
    ]);

    await useCases.removeIdentityDestination("user-1", identity.id, "destination-1");
    expect(routes).toHaveLength(0);
    await expect(
      useCases.addIdentityDestination("user-2", identity.id, "destination-1"),
    ).rejects.toMatchObject<Partial<DestinationDomainError>>({ code: "identity_not_found" });
  });
});
