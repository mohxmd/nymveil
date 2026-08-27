import { describe, expect, test } from "bun:test";
import { NotificationClient } from "../src/client";
import { NoNotificationChannelsError, NotificationConfigurationError } from "../src/errors";
import type { NotificationChannel } from "../src/types";

describe("NotificationClient", () => {
  test("requires explicit default channels", async () => {
    const sendEmailAction = async () => undefined;
    const client = new NotificationClient({
      email: {
        defaultTo: "recipient@example.com",
        sendEmailAction,
      },
    });

    await expect(
      client.send({
        title: "Delivery status",
        message: "A notification is ready.",
      }),
    ).rejects.toBeInstanceOf(NoNotificationChannelsError);
  });

  test("sends to explicitly configured default channels", async () => {
    const sendEmailAction = async () => undefined;
    const client = new NotificationClient({
      defaultChannels: ["email"],
      email: {
        defaultTo: "recipient@example.com",
        sendEmailAction,
      },
    });

    const results = await client.send({
      title: "Delivery status",
      message: "A notification is ready.",
    });

    expect(results).toEqual([{ channel: "email", success: true }]);
  });

  test("uses explicitly selected channels instead of configured defaults", async () => {
    const sendEmailAction = async () => undefined;
    const client = new NotificationClient({
      defaultChannels: [],
      email: {
        defaultTo: "recipient@example.com",
        sendEmailAction,
      },
    });

    const results = await client.send(
      {
        title: "Delivery status",
        message: "A notification is ready.",
      },
      { channels: ["email"] },
    );

    expect(results).toEqual([{ channel: "email", success: true }]);
  });

  test("applies per-send delivery options", async () => {
    let attempts = 0;
    const sendEmailAction = async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary delivery failure");
      }
    };
    const client = new NotificationClient({
      defaultChannels: ["email"],
      email: {
        defaultTo: "recipient@example.com",
        sendEmailAction,
      },
    });

    const results = await client.send(
      {
        title: "Delivery status",
        message: "A notification is ready.",
      },
      { retries: 1, retryDelay: 0 },
    );

    expect(results).toEqual([{ channel: "email", success: true }]);
    expect(attempts).toBe(2);
  });

  test("supports custom providers without coupling the client to a channel", async () => {
    const provider = {
      send: async () => ({
        channel: "discord" as const,
        success: true,
      }),
    };
    const client = new NotificationClient({
      defaultChannels: ["telegram"],
      providers: { telegram: provider },
    });

    const results = await client.send({
      title: "Delivery status",
      message: "A notification is ready.",
    });

    expect(results).toEqual([{ channel: "telegram", success: true }]);
  });

  test("rejects custom providers that collide with built-in channels", () => {
    expect(
      () =>
        new NotificationClient({
          discord: { webhookUrl: "https://discord.com/api/webhooks/123/token" },
          providers: {
            discord: { send: async () => ({ channel: "discord", success: true }) },
          },
        }),
    ).toThrow(NotificationConfigurationError);
  });

  test("snapshots caller-owned channels before awaiting providers", async () => {
    const channels: NotificationChannel[] = ["slack", "email"];
    const client = new NotificationClient();
    const pending = client.send(
      { title: "Delivery status", message: "A notification is ready." },
      { channels },
    );

    channels.length = 0;

    const results = await pending;
    expect(results.map((result) => result.channel)).toEqual(["slack", "email"]);
    expect(results.every((result) => !result.success)).toBe(true);
  });
});
