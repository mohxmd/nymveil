import { describe, expect, test } from "bun:test";
import type {
  DeliveryAttemptRecord,
  DeliveryAttemptRepository,
  DestinationRecord,
} from "@nymveil/core";
import type { NotificationResult } from "@nymveil/notifications";

import {
  createDeliveryOrchestrator,
  type NymveilDeliveryRequest,
} from "../src/delivery/orchestrator";

const now = new Date("2026-08-30T12:00:00.000Z");

const event: NymveilDeliveryRequest = {
  eventId: "message-1@example.test",
  identityId: "identity-1",
  identityAddress: "github-k7x2@example.com",
  identityLabel: "GitHub",
  receivedAt: now,
  sender: "sender@example.test",
  subject: "Welcome",
};

function destination(
  id: string,
  provider: DestinationRecord["provider"] = "discord",
): DestinationRecord {
  return {
    id,
    userId: "user-1",
    provider,
    label: provider,
    targetRef: `${provider}-target-1`,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function createContext(
  send: (provider: string) => Promise<NotificationResult> = async (provider) => ({
    channel: provider,
    success: true,
  }),
  existing: DeliveryAttemptRecord[] = [],
) {
  const attempts = new Map(existing.map((attempt) => [attempt.deliveryKey, attempt]));
  const sentProviders: string[] = [];
  let id = 0;
  const repository: DeliveryAttemptRepository = {
    findByDeliveryKey: async (key) => attempts.get(key) ?? null,
    findById: async () => null,
    listByUserId: async () => [...attempts.values()],
    create: async (attempt) => {
      attempts.set(attempt.deliveryKey, attempt);
      return attempt;
    },
    update: async (attempt) => {
      attempts.set(attempt.deliveryKey, attempt);
      return attempt;
    },
  };
  const orchestrator = createDeliveryOrchestrator({
    attemptRepository: repository,
    clock: { now: () => now },
    idGenerator: { generate: () => `attempt-${++id}` },
    notificationDispatcher: {
      dispatch: async (_event, destination) => {
        const provider = destination.provider;
        sentProviders.push(provider);
        return [await send(provider)];
      },
    },
  });

  return { attempts, orchestrator, sentProviders };
}

describe("delivery orchestrator", () => {
  test("tracks independent provider results for each destination", async () => {
    const context = createContext(async (provider) => ({
      channel: provider,
      success: provider === "discord",
      ...(provider === "telegram" ? { error: "provider unavailable" } : {}),
    }));

    const result = await context.orchestrator.deliver(event, [
      destination("destination-1", "discord"),
      destination("destination-2", "telegram"),
    ]);

    expect(result.status).toBe("partially_failed");
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(["succeeded", "failed"]);
    expect(result.outcomes[1]?.attempt?.errorCode).toBe("provider_unavailable");
    expect(context.sentProviders.sort()).toEqual(["discord", "telegram"]);
  });

  test("does not send again when the stable delivery key already exists", async () => {
    const existing: DeliveryAttemptRecord = {
      id: "attempt-existing",
      deliveryKey: "message-1@example.test:destination-1",
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
    const context = createContext(async () => ({ channel: "discord", success: true }), [existing]);

    const result = await context.orchestrator.deliver(event, [destination("destination-1")]);

    expect(result).toMatchObject({ status: "deduplicated" });
    expect(result.outcomes[0]).toMatchObject({ status: "duplicate", attempt: existing });
    expect(context.sentProviders).toEqual([]);
  });

  test("records dashboard destinations as successful metadata deliveries", async () => {
    const context = createContext();

    const result = await context.orchestrator.deliver(event, [
      destination("destination-1", "dashboard"),
    ]);

    expect(result.status).toBe("succeeded");
    expect(result.outcomes[0]?.attempt?.errorCode).toBeNull();
    expect(context.sentProviders).toEqual([]);
  });

  test("does not resend a failed event automatically", async () => {
    const context = createContext(async () => ({
      channel: "discord",
      success: false,
      error: "provider rate limited",
    }));

    const first = await context.orchestrator.deliver(event, [destination("destination-1")]);
    const second = await context.orchestrator.deliver(event, [destination("destination-1")]);

    expect(first.status).toBe("failed");
    expect(second.status).toBe("deduplicated");
    expect(context.sentProviders).toEqual(["discord"]);
  });

  test("returns an isolated failure when attempt persistence fails", async () => {
    const sentProviders: string[] = [];
    const repository: DeliveryAttemptRepository = {
      findByDeliveryKey: async () => null,
      findById: async () => null,
      listByUserId: async () => [],
      create: async (attempt) => attempt,
      update: async (attempt) => {
        if (attempt.destinationId === "destination-1") {
          throw new Error("temporary database failure");
        }
        return attempt;
      },
    };
    const orchestrator = createDeliveryOrchestrator({
      attemptRepository: repository,
      clock: { now: () => now },
      idGenerator: { generate: () => "attempt-1" },
      notificationDispatcher: {
        dispatch: async (_event, destination) => {
          sentProviders.push(destination.provider);
          return [{ channel: destination.provider, success: true }];
        },
      },
    });

    const result = await orchestrator.deliver(event, [
      destination("destination-1", "discord"),
      destination("destination-2", "telegram"),
    ]);

    expect(result.status).toBe("partially_failed");
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(["failed", "succeeded"]);
    expect(sentProviders.sort()).toEqual(["discord", "telegram"]);
  });
});
