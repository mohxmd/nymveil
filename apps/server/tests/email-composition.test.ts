import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import type { DestinationRecord, IdentityRecord, InboundRoutingDecision } from "@nymveil/core";
import { describe, expect, test } from "bun:test";

import { createInboundEmailHandler } from "../src/email/composition";

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

function createEmailMessage(): ForwardableEmailMessage {
  return {
    from: "sender@example.test",
    to: "github-k7x2@example.com",
    headers: new Headers({ "Message-ID": "<message-1@example.test>" }),
    raw: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Subject: Welcome\r\n\r\nHello"));
        controller.close();
      },
    }),
    rawSize: 27,
    setReject: () => undefined,
    forward: async () => ({ messageId: "forwarded-message-1" }),
    reply: async () => ({ messageId: "replied-message-1" }),
  } as ForwardableEmailMessage;
}

describe("inbound email composition", () => {
  test("connects the Cloudflare event to routing and delivery ports", async () => {
    let delivered: unknown;
    const decision: InboundRoutingDecision = {
      accepted: true,
      identity,
      destinations: [destination],
    };
    const handler = createInboundEmailHandler({
      routing: { route: async () => decision },
      delivery: {
        deliver: async (event, destinations) => {
          delivered = { event, destinations };
        },
      },
    });

    await handler(createEmailMessage(), {}, {});

    expect(delivered).toMatchObject({
      event: {
        eventId: "<message-1@example.test>",
        identityId: "identity-1",
        identityAddress: "github-k7x2@example.com",
        identityLabel: "GitHub",
        sender: "sender@example.test",
        subject: "Welcome",
      },
      destinations: [destination],
    });
  });
});
