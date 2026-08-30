import { describe, expect, test } from "bun:test";
import type {
  DestinationRecord,
  IdentityRecord,
  InboundEmail,
  InboundRoutingDecision,
} from "@nymveil/core";

import { createInboundEmailProcessor } from "../src/email/processor";

const now = new Date("2026-08-30T12:00:00.000Z");

const identity: IdentityRecord = {
  id: "identity-1",
  userId: "user-1",
  domainId: "domain-1",
  localPart: "github-k7x2",
  address: "github-k7x2@example.com",
  label: "GitHub",
  status: "active",
  expiresAt: null,
  torchedAt: null,
  createdAt: now,
  updatedAt: now,
};

const destination: DestinationRecord = {
  id: "destination-1",
  userId: "user-1",
  provider: "discord",
  label: "Discord",
  targetRef: "discord-target-1",
  enabled: true,
  createdAt: now,
  updatedAt: now,
};

function createInboundEmail(rawMessage: string, rawSize = rawMessage.length): InboundEmail {
  return {
    from: "sender@example.test",
    to: "github-k7x2@example.com",
    headers: { "message-id": "<envelope-1@example.test>" },
    messageId: "<envelope-1@example.test>",
    rawSize,
    raw: (async function* () {
      yield new TextEncoder().encode(rawMessage);
    })(),
  };
}

function acceptedDecision(): InboundRoutingDecision {
  return { accepted: true, identity, destinations: [destination] };
}

describe("inbound email processor", () => {
  test("routes before parsing and delivers safe metadata for accepted mail", async () => {
    let received: unknown;
    const processor = createInboundEmailProcessor({
      routing: { route: async () => acceptedDecision() },
      delivery: {
        deliver: async (event, destinations) => {
          received = { event, destinations };
        },
      },
      clock: { now: () => now },
    });

    await processor.process(createInboundEmail("Subject: Welcome\r\n\r\nHello from the service."));

    expect(received).toEqual({
      event: {
        eventId: "<envelope-1@example.test>",
        identityId: "identity-1",
        identityAddress: "github-k7x2@example.com",
        identityLabel: "GitHub",
        receivedAt: now,
        sender: "sender@example.test",
        subject: "Welcome",
      },
      destinations: [destination],
    });
  });

  test("discards rejected recipients without consuming their raw message", async () => {
    let consumed = false;
    let delivered = false;
    const processor = createInboundEmailProcessor({
      routing: {
        route: async () => ({ accepted: false, reason: "identity_not_found" }),
      },
      delivery: {
        deliver: async () => {
          delivered = true;
        },
      },
    });
    const message = {
      ...createInboundEmail("Subject: ignored\r\n\r\nignored"),
      raw: (async function* () {
        consumed = true;
        yield new TextEncoder().encode("ignored");
      })(),
    } satisfies InboundEmail;

    await processor.process(message);

    expect(consumed).toBe(false);
    expect(delivered).toBe(false);
  });

  test("discards malformed content without invoking delivery", async () => {
    let delivered = false;
    const processor = createInboundEmailProcessor({
      routing: { route: async () => acceptedDecision() },
      delivery: {
        deliver: async () => {
          delivered = true;
        },
      },
    });

    await processor.process({
      ...createInboundEmail("Subject: ignored\r\n\r\nignored"),
      raw: {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<Uint8Array>> {
              throw new Error("parser transport failure");
            },
          };
        },
      },
    });

    expect(delivered).toBe(false);
  });
});
