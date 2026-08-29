import { describe, expect, test } from "bun:test";
import type { InboundEmail } from "@nymveil/core";

import { InboundEmailParseError, parseInboundEmail } from "../src/email/parser";

function createInboundEmail(rawMessage: string, rawSize = rawMessage.length): InboundEmail {
  return {
    from: "sender@example.test",
    to: "identity@example.test",
    headers: { "message-id": "<envelope-1@example.test>" },
    messageId: "<envelope-1@example.test>",
    rawSize,
    raw: (async function* () {
      yield new TextEncoder().encode(rawMessage);
    })(),
  };
}

function createFailingRaw(): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          throw new Error("private parser failure details");
        },
      };
    },
  };
}

describe("inbound email parser", () => {
  test("parses and normalizes common MIME content without retaining attachment bytes", async () => {
    const parsed = await parseInboundEmail(
      createInboundEmail(
        [
          "From: Header Sender <header@example.test>",
          "To: identity@example.test",
          "Message-ID: <parsed-1@example.test>",
          "Subject:   Welcome   to Nymveil ",
          "Content-Type: multipart/alternative; boundary=boundary-1",
          "",
          "--boundary-1",
          "Content-Type: text/plain; charset=utf-8",
          "",
          "Hello\r\n\r\nWorld",
          "--boundary-1",
          "Content-Type: text/html; charset=utf-8",
          "",
          "<p>Hello</p><script>alert('unsafe')</script><p>World</p>",
          "--boundary-1--",
          "",
        ].join("\r\n"),
      ),
    );

    expect(parsed).toMatchObject({
      from: "header@example.test",
      to: "identity@example.test",
      subject: "Welcome to Nymveil",
      text: "Hello\n\nWorld",
      html: "Hello<br><br>World",
      messageId: "<parsed-1@example.test>",
    });
    expect(parsed.attachments).toEqual([]);
  });

  test("rejects a message before consuming the raw stream when its declared size is too large", async () => {
    let consumed = false;
    const message = {
      ...createInboundEmail("Subject: ignored\r\n\r\nignored", 101),
      raw: (async function* () {
        consumed = true;
        yield new Uint8Array();
      })(),
    } satisfies InboundEmail;

    await expect(parseInboundEmail(message, { maxMessageSize: 100 })).rejects.toEqual(
      new InboundEmailParseError(
        "message_too_large",
        "The inbound email exceeds the configured message size limit.",
      ),
    );
    expect(consumed).toBe(false);
  });

  test("handles malformed MIME safely without exposing parser content", async () => {
    const parsed = await parseInboundEmail(
      createInboundEmail("Content-Type: multipart/mixed; boundary=missing\r\n\r\n"),
    );

    expect(parsed).toMatchObject({
      text: null,
      html: null,
      attachments: [],
    });
  });

  test("maps raw stream failures to a safe parse error", async () => {
    const message = {
      ...createInboundEmail("Subject: ignored\r\n\r\nignored"),
      raw: createFailingRaw(),
    } satisfies InboundEmail;

    await expect(parseInboundEmail(message)).rejects.toEqual(
      new InboundEmailParseError("malformed_message", "The inbound email could not be parsed."),
    );
  });

  test("enforces the attachment size limit", async () => {
    const message = createInboundEmail(
      [
        "Content-Type: multipart/mixed; boundary=boundary-2",
        "",
        "--boundary-2",
        "Content-Type: text/plain",
        "",
        "body",
        "--boundary-2",
        "Content-Type: application/octet-stream",
        "Content-Disposition: attachment; filename=payload.bin",
        "Content-Transfer-Encoding: base64",
        "",
        "YWJjZA==",
        "--boundary-2--",
        "",
      ].join("\r\n"),
    );

    await expect(parseInboundEmail(message, { maxAttachmentSize: 3 })).rejects.toMatchObject({
      code: "attachment_too_large",
    });
  });
});
