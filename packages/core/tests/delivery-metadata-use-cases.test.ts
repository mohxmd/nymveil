import { describe, expect, test } from "bun:test";

import {
  DeliveryMetadataUseCases,
  type DeliveryAttemptRecord,
  type DeliveryAttemptRepository,
} from "../src";

const now = new Date("2026-08-30T12:00:00.000Z");

const attempt: DeliveryAttemptRecord = {
  id: "attempt-1",
  deliveryKey: "event-1:destination-1",
  userId: "user-1",
  identityId: "identity-1",
  destinationId: "destination-1",
  provider: "discord",
  status: "succeeded",
  attemptedAt: now,
  completedAt: now,
  errorCode: null,
  createdAt: now,
  updatedAt: now,
};

function createContext() {
  let received: { userId: string; limit?: number } | undefined;
  const repository: DeliveryAttemptRepository = {
    findByDeliveryKey: async () => null,
    findById: async () => null,
    listByUserId: async (userId, options) => {
      received = { userId, limit: options?.limit };
      return [attempt];
    },
    create: async (record) => record,
    update: async (record) => record,
  };

  return {
    useCases: new DeliveryMetadataUseCases({ deliveryAttemptRepository: repository }),
    getReceived: () => received,
  };
}

describe("DeliveryMetadataUseCases", () => {
  test("lists recent attempts with the default limit", async () => {
    const { useCases, getReceived } = createContext();

    await expect(useCases.listRecentAttempts(" user-1 ")).resolves.toEqual([attempt]);
    expect(getReceived()).toEqual({ userId: "user-1", limit: 50 });
  });

  test("passes a valid custom limit to the repository", async () => {
    const { useCases, getReceived } = createContext();

    await useCases.listRecentAttempts("user-1", 100);

    expect(getReceived()).toEqual({ userId: "user-1", limit: 100 });
  });

  test("rejects invalid owners and limits", async () => {
    const { useCases } = createContext();

    await expect(useCases.listRecentAttempts(" ")).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(useCases.listRecentAttempts("user-1", 0)).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(useCases.listRecentAttempts("user-1", 101)).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
