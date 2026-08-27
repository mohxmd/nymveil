import { describe, expect, test } from "bun:test";
import { NotificationClient } from "../src/client";
import type { NotificationChannel } from "../src/types";

describe("NotificationClient", () => {
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
