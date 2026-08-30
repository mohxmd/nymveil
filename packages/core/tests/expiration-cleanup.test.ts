import { describe, expect, test } from "bun:test";

import { ExpirationCleanup, type IdentityMaintenanceRepository, type IdentityRecord } from "../src";

const now = new Date("2026-08-30T12:00:00.000Z");

function createIdentity(overrides: Partial<IdentityRecord> = {}): IdentityRecord {
  return {
    id: "identity-1",
    userId: "user-1",
    domainId: "domain-1",
    localPart: "github-k7x2",
    address: "github-k7x2@example.com",
    label: "GitHub",
    status: "active",
    expiresAt: new Date("2026-08-30T11:00:00.000Z"),
    torchedAt: null,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    updatedAt: new Date("2026-08-01T12:00:00.000Z"),
    ...overrides,
  };
}

function createMaintenanceRepository(identities: IdentityRecord[]) {
  const expiredIds: string[] = [];
  const repository: IdentityMaintenanceRepository = {
    async listActiveExpiringBefore(before) {
      return identities.filter(
        (identity) =>
          identity.status === "active" &&
          identity.expiresAt !== null &&
          identity.expiresAt <= before,
      );
    },
    async expire(identityId, expirationTime) {
      const identity = identities.find((candidate) => candidate.id === identityId);

      if (
        !identity ||
        identity.status !== "active" ||
        identity.expiresAt === null ||
        identity.expiresAt > expirationTime
      ) {
        return false;
      }

      identity.status = "expired";
      identity.updatedAt = expirationTime;
      expiredIds.push(identityId);
      return true;
    },
    async deleteExpiredBefore() {
      return 0;
    },
  };

  return { expiredIds, repository };
}

describe("expiration cleanup", () => {
  test("expires due identities and removes eligible metadata", async () => {
    const { expiredIds, repository } = createMaintenanceRepository([createIdentity()]);
    const deletedIdentityCutoffs: Date[] = [];
    const deletedMetadataCutoffs: Date[] = [];

    const cleanup = new ExpirationCleanup({
      clock: { now: () => now },
      identityMaintenanceRepository: {
        ...repository,
        deleteExpiredBefore: async (before) => {
          deletedIdentityCutoffs.push(before);
          return 2;
        },
      },
      deliveryMetadataMaintenanceRepository: {
        deleteCompletedBefore: async (before) => {
          deletedMetadataCutoffs.push(before);
          return 3;
        },
      },
      policy: {
        batchSize: 10,
        expiredIdentityRetentionMs: 60_000,
        deliveryMetadataRetentionMs: 120_000,
      },
    });

    await expect(cleanup.run()).resolves.toEqual({
      expiredIdentityCount: 1,
      deletedIdentityCount: 2,
      deletedDeliveryMetadataCount: 3,
      expiryReminderCount: 0,
    });
    expect(expiredIds).toEqual(["identity-1"]);
    expect(deletedIdentityCutoffs).toEqual([new Date("2026-08-30T11:59:00.000Z")]);
    expect(deletedMetadataCutoffs).toEqual([new Date("2026-08-30T11:58:00.000Z")]);
  });

  test("does not transition a torched identity", async () => {
    const torchedIdentity = createIdentity({
      status: "torched",
      torchedAt: new Date("2026-08-30T10:00:00.000Z"),
    });
    const { expiredIds, repository } = createMaintenanceRepository([torchedIdentity]);
    const cleanup = new ExpirationCleanup({
      clock: { now: () => now },
      identityMaintenanceRepository: {
        ...repository,
        listActiveExpiringBefore: async () => [torchedIdentity],
      },
      deliveryMetadataMaintenanceRepository: {
        deleteCompletedBefore: async () => 0,
      },
    });

    await cleanup.run();

    expect(expiredIds).toEqual([]);
    expect(torchedIdentity.status).toBe("torched");
  });

  test("runs optional reminders with a stable key", async () => {
    const identity = createIdentity({
      expiresAt: new Date("2026-08-30T13:00:00.000Z"),
    });
    const { repository } = createMaintenanceRepository([identity]);
    const reminders: string[] = [];
    const cleanup = new ExpirationCleanup({
      clock: { now: () => now },
      identityMaintenanceRepository: repository,
      deliveryMetadataMaintenanceRepository: {
        deleteCompletedBefore: async () => 0,
      },
      onExpiryReminder: async (_identity, key) => {
        reminders.push(key);
      },
      policy: { expiryReminderWindowMs: 3_600_000 },
    });

    const result = await cleanup.run();

    expect(result.expiryReminderCount).toBe(1);
    expect(reminders).toEqual(["identity-expiry:identity-1:2026-08-30T13:00:00.000Z"]);
  });

  test("rejects invalid cleanup policy values", () => {
    expect(
      () =>
        new ExpirationCleanup({
          identityMaintenanceRepository: createMaintenanceRepository([]).repository,
          deliveryMetadataMaintenanceRepository: {
            deleteCompletedBefore: async () => 0,
          },
          policy: { batchSize: 0 },
        }),
    ).toThrow("batchSize must be greater than zero");
  });
});
