import { describe, expect, test } from "bun:test";
import type {
  DestinationConfigurationRecord,
  DestinationConfigurationRepository,
} from "@nymveil/db";

import {
  createDestinationCredentialStore,
  DestinationCredentialError,
} from "../src/delivery/destination-credentials";

function key(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function createRepository() {
  let record: DestinationConfigurationRecord | null = null;
  const repository: DestinationConfigurationRepository = {
    findByDestinationId: async () => record,
    upsert: async (input) => {
      record = {
        destinationId: input.destinationId,
        ciphertext: input.ciphertext,
        nonce: input.nonce,
        createdAt: input.createdAt ?? new Date(),
        updatedAt: input.updatedAt ?? new Date(),
      };
      return record;
    },
    delete: async () => {
      record = null;
    },
  };

  return { repository, getRecord: () => record };
}

describe("destination credential store", () => {
  test("encrypts credentials at rest and decrypts them on read", async () => {
    const context = createRepository();
    const store = createDestinationCredentialStore(context.repository, key());
    const configuration = { botToken: "secret-token", protectContent: true };

    await store.save("destination-1", configuration);

    expect(context.getRecord()).toMatchObject({ destinationId: "destination-1" });
    expect(context.getRecord()?.ciphertext).not.toContain("secret-token");
    await expect(store.get("destination-1")).resolves.toEqual(configuration);
  });

  test("rejects invalid encryption keys without exposing configuration details", async () => {
    const context = createRepository();
    const store = createDestinationCredentialStore(context.repository, "invalid-key");

    await expect(
      store.save("destination-1", { webhookUrl: "https://example.test" }),
    ).rejects.toBeInstanceOf(DestinationCredentialError);
  });
});
