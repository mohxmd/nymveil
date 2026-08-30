import type { DestinationConfigurationRepository } from "@nymveil/db";
import type { DestinationCredentialStore } from "../modules/destinations/ports";
import { DestinationConfigurationError } from "./errors";

export class DestinationCredentialError extends DestinationConfigurationError {
  constructor(message = "Destination credentials are unavailable.") {
    super(message);
    this.name = "DestinationCredentialError";
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < value.length; index += 0x8000) {
    binary += String.fromCharCode(...value.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function isConfigurationObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createDestinationCredentialStore(
  repository: DestinationConfigurationRepository,
  encryptionKey: string | undefined,
): DestinationCredentialStore {
  async function getKey(): Promise<CryptoKey> {
    if (!encryptionKey) {
      throw new DestinationCredentialError();
    }

    let keyBytes: Uint8Array;
    try {
      keyBytes = decodeBase64(encryptionKey);
    } catch {
      throw new DestinationCredentialError();
    }

    if (keyBytes.byteLength !== 32) {
      throw new DestinationCredentialError();
    }

    return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  return {
    async save(destinationId, configuration) {
      if (!isConfigurationObject(configuration)) {
        throw new DestinationCredentialError();
      }

      const key = await getKey();
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(configuration));
      const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext),
      );

      await repository.upsert({
        destinationId,
        ciphertext: encodeBase64(ciphertext),
        nonce: encodeBase64(nonce),
      });
    },

    async get(destinationId) {
      const record = await repository.findByDestinationId(destinationId);
      if (!record) return null;

      try {
        const key = await getKey();
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: decodeBase64(record.nonce) },
          key,
          decodeBase64(record.ciphertext),
        );
        return JSON.parse(new TextDecoder().decode(plaintext));
      } catch {
        throw new DestinationCredentialError();
      }
    },

    delete(destinationId) {
      return repository.delete(destinationId);
    },
  };
}
