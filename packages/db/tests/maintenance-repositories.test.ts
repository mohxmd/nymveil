import { describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";

import { createDbFromClient } from "../src/client";
import { createDeliveryMetadataMaintenanceRepository } from "../src/repositories/delivery-metadata-maintenance-repository";
import { createIdentityMaintenanceRepository } from "../src/repositories/identity-maintenance-repository";
import { deliveryAttempt, destination, domain, identity, user } from "../src/schema";

const now = new Date("2026-08-30T12:00:00.000Z");

async function createTestContext() {
  const client = createClient({ url: "file::memory:" });

  for (const file of [
    "0000_identity_model.sql",
    "0001_cloudy_molecule_man.sql",
    "0002_orange_deathbird.sql",
  ]) {
    const migration = await Bun.file(new URL(`../src/migrations/${file}`, import.meta.url)).text();

    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        await client.execute(statement);
      }
    }
  }

  const db = createDbFromClient(client);
  await db.insert(user).values({
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  });
  await db.insert(domain).values({
    id: "domain-1",
    userId: "user-1",
    hostname: "example.com",
    status: "verified",
  });
  await db.insert(destination).values({
    id: "destination-1",
    userId: "user-1",
    provider: "discord",
    label: "Discord",
    targetRef: "discord-user-1",
  });
  await db.insert(identity).values([
    {
      id: "identity-active-due",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "active-due",
      address: "active-due@example.com",
      label: "Due identity",
      status: "active",
      expiresAt: new Date("2026-08-30T11:00:00.000Z"),
    },
    {
      id: "identity-active-future",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "active-future",
      address: "active-future@example.com",
      label: "Future identity",
      status: "active",
      expiresAt: new Date("2026-08-30T13:00:00.000Z"),
    },
    {
      id: "identity-expired-old",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "expired-old",
      address: "expired-old@example.com",
      label: "Old expired identity",
      status: "expired",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    },
    {
      id: "identity-expired-recent",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "expired-recent",
      address: "expired-recent@example.com",
      label: "Recent expired identity",
      status: "expired",
      expiresAt: new Date("2026-08-15T12:00:00.000Z"),
    },
    {
      id: "identity-torched-old",
      userId: "user-1",
      domainId: "domain-1",
      localPart: "torched-old",
      address: "torched-old@example.com",
      label: "Torched identity",
      status: "torched",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
      torchedAt: new Date("2026-07-02T12:00:00.000Z"),
    },
  ]);

  return {
    client,
    db,
    identityRepository: createIdentityMaintenanceRepository(db),
    metadataRepository: createDeliveryMetadataMaintenanceRepository(db),
  };
}

describe("maintenance repositories", () => {
  test("selects and expires only due active identities", async () => {
    const { identityRepository } = await createTestContext();

    expect(
      (await identityRepository.listActiveExpiringBefore(now, 10)).map((row) => row.id),
    ).toEqual(["identity-active-due"]);
    expect(await identityRepository.expire("identity-active-due", now)).toBe(true);
    expect(await identityRepository.expire("identity-active-due", now)).toBe(false);
    expect(await identityRepository.expire("identity-torched-old", now)).toBe(false);
  });

  test("deletes old expired identities but retains recent and torched records", async () => {
    const { db, identityRepository } = await createTestContext();
    const deleted = await identityRepository.deleteExpiredBefore(
      new Date("2026-07-31T12:00:00.000Z"),
      10,
    );

    expect(deleted).toBe(1);
    expect(await db.select({ id: identity.id }).from(identity)).toEqual([
      { id: "identity-active-due" },
      { id: "identity-active-future" },
      { id: "identity-expired-recent" },
      { id: "identity-torched-old" },
    ]);
  });

  test("deletes completed delivery metadata but preserves pending attempts", async () => {
    const { db, metadataRepository } = await createTestContext();
    await db.insert(deliveryAttempt).values([
      {
        id: "attempt-old-succeeded",
        deliveryKey: "event-old-succeeded:destination-1",
        userId: "user-1",
        identityId: "identity-active-due",
        destinationId: "destination-1",
        provider: "discord",
        status: "succeeded",
        attemptedAt: new Date("2026-07-01T12:00:00.000Z"),
        completedAt: new Date("2026-07-01T12:01:00.000Z"),
      },
      {
        id: "attempt-old-pending",
        deliveryKey: "event-old-pending:destination-1",
        userId: "user-1",
        identityId: "identity-active-due",
        destinationId: "destination-1",
        provider: "discord",
        status: "pending",
        attemptedAt: new Date("2026-07-01T12:00:00.000Z"),
      },
      {
        id: "attempt-recent-failed",
        deliveryKey: "event-recent-failed:destination-1",
        userId: "user-1",
        identityId: "identity-active-due",
        destinationId: "destination-1",
        provider: "discord",
        status: "failed",
        attemptedAt: new Date("2026-08-20T12:00:00.000Z"),
        completedAt: new Date("2026-08-20T12:01:00.000Z"),
      },
    ]);

    expect(
      await metadataRepository.deleteCompletedBefore(new Date("2026-07-31T12:00:00.000Z"), 10),
    ).toBe(1);
    expect(
      (await db.select({ id: deliveryAttempt.id }).from(deliveryAttempt)).map((row) => row.id),
    ).toEqual(["attempt-old-pending", "attempt-recent-failed"]);
  });
});
