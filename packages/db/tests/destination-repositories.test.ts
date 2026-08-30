import { describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";

import { createDbFromClient } from "../src/client";
import { createDestinationRepository } from "../src/repositories/destination-repository";
import { createIdentityDestinationRepository } from "../src/repositories/identity-destination-repository";
import { destinationConfiguration, domain, identity, user } from "../src/schema";

const now = new Date("2026-08-30T12:00:00.000Z");

async function createTestContext() {
  const client = createClient({ url: "file::memory:" });

  for (const file of [
    "0000_identity_model.sql",
    "0001_cloudy_molecule_man.sql",
    "0002_orange_deathbird.sql",
    "0003_dear_plazm.sql",
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

  return {
    db,
    destinationRepository: createDestinationRepository(db),
    identityDestinationRepository: createIdentityDestinationRepository(db),
  };
}

describe("destination repositories", () => {
  test("persists destinations and identity routes with owner-scoped updates", async () => {
    const { destinationRepository, identityDestinationRepository } = await createTestContext();
    const created = await destinationRepository.create({
      id: "destination-1",
      userId: "user-1",
      provider: "discord",
      label: "Discord",
      targetRef: "discord-target-1",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    const updated = await destinationRepository.update({
      ...created,
      enabled: false,
      updatedAt: now,
    });
    const route = await identityDestinationRepository.add({
      identityId: "identity-1",
      destinationId: created.id,
      createdAt: now,
    });

    expect(updated.enabled).toBe(false);
    expect(await destinationRepository.findById(created.id)).toEqual(updated);
    expect(await destinationRepository.listByUserId("user-1")).toEqual([updated]);
    await expect(destinationRepository.update({ ...updated, userId: "user-2" })).rejects.toThrow(
      "The destination was not found.",
    );
    expect(await identityDestinationRepository.listByIdentityId("identity-1")).toEqual([route]);

    await identityDestinationRepository.remove("identity-1", created.id);
    expect(await identityDestinationRepository.listByIdentityId("identity-1")).toEqual([]);
  });

  test("stores encrypted destination configuration separately from destination metadata", async () => {
    const { db, destinationRepository } = await createTestContext();
    const created = await destinationRepository.create({
      id: "destination-2",
      userId: "user-1",
      provider: "discord",
      label: "Discord",
      targetRef: "discord-target-2",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(destinationConfiguration).values({
      destinationId: created.id,
      ciphertext: "encrypted-value",
      nonce: "nonce-value",
      createdAt: now,
      updatedAt: now,
    });

    expect(await db.select().from(destinationConfiguration)).toEqual([
      {
        destinationId: created.id,
        ciphertext: "encrypted-value",
        nonce: "nonce-value",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });
});
