import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import { describe, expect, test } from "bun:test";

import {
  CloudflareEmailAdapterError,
  createCloudflareEmailHandler,
  normalizeCloudflareEmailMessage,
} from "../src/email/cloudflare-adapter";

function createEmailMessage(
  overrides: Partial<
    Pick<ForwardableEmailMessage, "from" | "to" | "headers" | "raw" | "rawSize">
  > = {},
): ForwardableEmailMessage {
  return {
    from: " Sender@Example.TEST ",
    to: " GitHub-K7X2@Example.TEST ",
    headers: new Headers({
      "Message-ID": " <message-1@example.test> ",
      Subject: "Welcome",
    }),
    raw: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("raw message"));
        controller.close();
      },
    }),
    rawSize: 12,
    ...overrides,
  } as ForwardableEmailMessage;
}

describe("Cloudflare email adapter", () => {
  test("normalizes the Cloudflare event and passes it to the processor", async () => {
    let received: Awaited<ReturnType<typeof normalizeCloudflareEmailMessage>> | undefined;
    let rawText = "";

    const handler = createCloudflareEmailHandler({
      async process(message) {
        received = message;

        for await (const chunk of message.raw) {
          rawText += new TextDecoder().decode(chunk);
        }
      },
    });

    await handler(createEmailMessage());

    expect(received).toMatchObject({
      from: "sender@example.test",
      to: "github-k7x2@example.test",
      headers: {
        "message-id": "<message-1@example.test>",
        subject: "Welcome",
      },
      messageId: "<message-1@example.test>",
      rawSize: 12,
    });
    expect(rawText).toBe("raw message");
  });

  test("allows an empty envelope sender for bounce messages", () => {
    expect(normalizeCloudflareEmailMessage(createEmailMessage({ from: "" })).from).toBe("");
  });

  test("rejects an empty recipient before processing", async () => {
    const process = async () => undefined;
    const handler = createCloudflareEmailHandler({ process });

    await expect(handler(createEmailMessage({ to: "  " }))).rejects.toEqual(
      new CloudflareEmailAdapterError(
        "invalid_recipient",
        "The inbound email recipient is required.",
      ),
    );
  });

  test("rejects invalid raw sizes before processing", () => {
    expect(() => normalizeCloudflareEmailMessage(createEmailMessage({ rawSize: -1 }))).toThrow(
      new CloudflareEmailAdapterError(
        "invalid_raw_size",
        "The inbound email raw size must be a non-negative safe integer.",
      ),
    );
  });
});
