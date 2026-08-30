import { describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";

import { DeliveryKeyConflictError } from "@nymveil/core";

import { createDbFromClient } from "../src/client";
import { createDeliveryAttemptRepository } from "../src/repositories/delivery-attempt-repository";
import { destination, domain, identity, user } from "../src/schema";

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
  await db.insert(identity).values({
    id: "identity-1",
    userId: "user-1",
    domainId: "domain-1",
    localPart: "github-k7x2",
    address: "github-k7x2@example.com",
    label: "GitHub",
    status: "active",
  });
  await db.insert(destination).values({
    id: "destination-1",
    userId: "user-1",
    provider: "discord",
    label: "Discord",
    targetRef: "discord-user-1",
  });

  return { client, db, repository: createDeliveryAttemptRepository(db) };
}

const pendingAttempt = {
  id: "attempt-1",
  deliveryKey: "event-1:destination-1",
  userId: "user-1",
  identityId: "identity-1",
  destinationId: "destination-1",
  provider: "discord" as const,
  status: "pending" as const,
  attemptedAt: now,
  completedAt: null,
  errorCode: null,
  createdAt: now,
  updatedAt: now,
};

describe("delivery attempt repository", () => {
  test("persists, lists, and updates privacy-safe delivery metadata", async () => {
    const { repository } = await createTestContext();

    const created = await repository.create(pendingAttempt);
    const updated = await repository.update({
      ...created,
      status: "succeeded",
      completedAt: now,
      updatedAt: now,
    });

    expect(await repository.findByDeliveryKey(pendingAttempt.deliveryKey)).toEqual(updated);
    expect(await repository.findById("user-1", pendingAttempt.id)).toEqual(updated);
    expect(await repository.listByUserId("user-1")).toEqual([updated]);
    expect(await repository.findById("user-2", pendingAttempt.id)).toBeNull();
  });

  test("rejects duplicate delivery keys", async () => {
    const { repository } = await createTestContext();

    await repository.create(pendingAttempt);

    await expect(repository.create({ ...pendingAttempt, id: "attempt-2" })).rejects.toBeInstanceOf(
      DeliveryKeyConflictError,
    );
  });
});
