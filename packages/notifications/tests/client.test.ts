import { describe, expect, test } from "bun:test";
import { NotificationClient } from "../src/client";
import { NoNotificationChannelsError } from "../src/errors";
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
