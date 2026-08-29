import { describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { IdentityUseCases } from "@nymveil/core";
import { eq } from "drizzle-orm";

import { createDbFromClient } from "../src/client";
import { createDomainRepository } from "../src/repositories/domain-repository";
import { createIdentityRepository } from "../src/repositories/identity-repository";
import { domain, identity, user } from "../src/schema";

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

  const identityRepository = createIdentityRepository(db);
  const useCases = new IdentityUseCases({
    clock: { now: () => new Date(now) },
    domainRepository: createDomainRepository(db),
    identityRepository,
    idGenerator: { generate: () => "identity-1" },
    localPartGenerator: { generate: () => "github-k7x2" },
  });

  return { client, db, identityRepository, useCases };
}

describe("identity repository", () => {
  test("persists, lists, and updates identities through the core use cases", async () => {
    const { identityRepository, useCases } = await createTestContext();

    const created = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });
    const updated = await useCases.updateIdentity("user-1", created.id, {
      label: "GitHub account",
    });

    expect(await identityRepository.findById(created.id)).toEqual(updated);
    expect(await identityRepository.findByAddress("github-k7x2@example.com")).toEqual(updated);
    expect(await identityRepository.listByUserId("user-1")).toEqual([updated]);
    expect(await identityRepository.listByUserId("user-2")).toEqual([]);
  });

  test("materializes expiration and persists permanent torch state", async () => {
    const { db, identityRepository, useCases } = await createTestContext();
    const created = await useCases.createIdentity({
      userId: "user-1",
      domainId: "domain-1",
      label: "GitHub",
    });

    await db
      .update(identity)
      .set({ expiresAt: new Date("2026-08-30T11:59:00.000Z") })
      .where(eq(identity.id, created.id));

    const expired = await useCases.getIdentity("user-1", created.id);
    const torched = await useCases.torchIdentity("user-1", created.id);

    expect(expired.status).toBe("expired");
    expect(torched.status).toBe("torched");
    expect((await identityRepository.findById(created.id))?.torchedAt).toEqual(now);
  });
});
