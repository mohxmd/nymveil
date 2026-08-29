import { describe, expect, test } from "bun:test";
import {
  NotificationClient,
  type NotificationPayload,
  type NotificationProvider,
} from "@nymveil/notifications";

import {
  createNymveilNotificationClient,
  createNymveilNotificationDispatcher,
  toNotificationPayload,
} from "../src/delivery/notifications";

const event = {
  identityAddress: "github-k7x2@example.com",
  identityLabel: "GitHub",
  receivedAt: new Date("2026-08-30T12:00:00.000Z"),
  sender: "noreply@example.test",
  subject: "Welcome",
};

function createFakeProvider(channel: "discord" | "telegram", calls: NotificationPayload[]) {
  return {
    send: async (payload: NotificationPayload) => {
      calls.push(payload);
      return { channel, success: true };
    },
  } satisfies NotificationProvider;
}

describe("Nymveil notification dispatcher", () => {
  test("maps a delivery event and sends only to explicitly selected channels", async () => {
    const calls: NotificationPayload[] = [];
    const client = new NotificationClient({
      providers: {
        discord: createFakeProvider("discord", calls),
        telegram: createFakeProvider("telegram", calls),
      },
    });
    const dispatcher = createNymveilNotificationDispatcher(client);

    const results = await dispatcher.dispatch(event, ["discord"]);

    expect(results).toEqual([{ channel: "discord", success: true }]);
    expect(calls).toEqual([
      {
        title: "New email received",
        message: "A message was received for GitHub (github-k7x2@example.com).",
        metadata: {
          address: "github-k7x2@example.com",
          sender: "noreply@example.test",
          subject: "Welcome",
          receivedAt: "2026-08-30T12:00:00.000Z",
        },
      },
    ]);
  });

  test("rejects delivery without explicit channels", async () => {
    const client = new NotificationClient();
    const dispatcher = createNymveilNotificationDispatcher(client);

    await expect(dispatcher.dispatch(event, [])).rejects.toBeInstanceOf(Error);
  });

  test("validates provider configuration before creating the client", () => {
    expect(() =>
      createNymveilNotificationClient({
        telegram: { botToken: "", chatId: 123 },
      }),
    ).toThrow();

    expect(() =>
      createNymveilNotificationClient({
        discord: { webhookUrl: "https://discord.example.test/webhook" },
      }),
    ).not.toThrow();
  });

  test("creates a safe metadata-only payload", () => {
    expect(toNotificationPayload({ ...event, subject: null, sender: null })).toEqual({
      title: "New email received",
      message: "A message was received for GitHub (github-k7x2@example.com).",
      metadata: {
        address: "github-k7x2@example.com",
        receivedAt: "2026-08-30T12:00:00.000Z",
      },
    });
  });
});
