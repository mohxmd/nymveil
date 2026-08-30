import type { InboundEmail, InboundEmailAttachment, ParsedInboundEmail } from "@nymveil/core";
import PostalMime from "postal-mime";
import type { Address, Attachment, Email, Mailbox, PostalMimeOptions } from "postal-mime";

export const defaultEmailParsingLimits = {
  maxMessageSize: 10 * 1024 * 1024,
  maxAttachmentSize: 5 * 1024 * 1024,
  maxHeadersSize: 256 * 1024,
  maxNestingDepth: 32,
  maxRfc822NestingDepth: 3,
} as const;

export type EmailParsingLimits = {
  [Key in keyof typeof defaultEmailParsingLimits]: number;
};

export type InboundEmailParseErrorCode =
  | "message_too_large"
  | "attachment_too_large"
  | "malformed_message";

export class InboundEmailParseError extends Error {
  constructor(
    readonly code: InboundEmailParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InboundEmailParseError";
  }
}

function assertLimits(limits: EmailParsingLimits): void {
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError("Email parsing limits must be non-negative safe integers.");
    }
  }
}

function normalizeText(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const withoutControlCharacters = [...normalized]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        codePoint <= 0x08 ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f
      );
    })
    .join("");

  return withoutControlCharacters || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isBlockTag(tagName: string): boolean {
  return /^(address|article|aside|blockquote|div|dl|fieldset|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul)$/i.test(
    tagName,
  );
}

function findTagEnd(value: string, start: number): number {
  let quote: '"' | "'" | null = null;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];

    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }

  return -1;
}

function htmlToText(value: string): string {
  let result = "";
  let index = 0;
  const lowercaseValue = value.toLowerCase();

  while (index < value.length) {
    if (value.startsWith("<!--", index)) {
      const commentEnd = value.indexOf("-->", index + 4);
      index = commentEnd === -1 ? value.length : commentEnd + 3;
      continue;
    }

    if (value[index] === "<") {
      const tagEnd = findTagEnd(value, index + 1);

      if (tagEnd === -1) {
        result += value[index];
        index += 1;
        continue;
      }

      const rawTag = value.slice(index + 1, tagEnd).trim();
      const closing = rawTag.startsWith("/");
      const tagName = rawTag
        .replace(/^\/?\s*/, "")
        .split(/[\s/>]/, 1)[0]
        ?.toLowerCase();

      if (!closing && (tagName === "script" || tagName === "style")) {
        const closingTag = lowercaseValue.indexOf(`</${tagName}`, tagEnd + 1);

        if (closingTag === -1) {
          break;
        }

        const closingEnd = findTagEnd(value, closingTag + tagName.length + 2);
        index = closingEnd === -1 ? value.length : closingEnd + 1;
        continue;
      }

      if (tagName && (isBlockTag(tagName) || tagName === "br")) {
        result += "\n";
      }

      index = tagEnd + 1;
      continue;
    }

    result += value[index];
    index += 1;
  }

  return normalizeText(result) ?? "";
}

function textToSafeHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.split("\n").map(escapeHtml).join("<br>");
}

function mailboxAddress(address: Address | undefined): string | null {
  if (!address || !isMailbox(address)) {
    return null;
  }

  const normalized = address.address.trim().toLowerCase();
  return normalized || null;
}

function isMailbox(address: Address): address is Mailbox {
  return "address" in address && typeof address.address === "string";
}

function attachmentSize(attachment: Attachment): number {
  if (typeof attachment.content === "string") {
    return new TextEncoder().encode(attachment.content).byteLength;
  }

  return attachment.content.byteLength;
}

function normalizeAttachment(
  attachment: Attachment,
  maxAttachmentSize: number,
): InboundEmailAttachment {
  const size = attachmentSize(attachment);

  if (size > maxAttachmentSize) {
    throw new InboundEmailParseError(
      "attachment_too_large",
      "An inbound email attachment exceeds the configured size limit.",
    );
  }

  return {
    filename: attachment.filename?.trim() || null,
    mimeType: attachment.mimeType.toLowerCase(),
    disposition: attachment.disposition,
    contentId: attachment.contentId?.trim() || null,
    size,
  };
}

async function* limitRawMessage(
  raw: AsyncIterable<Uint8Array>,
  maxMessageSize: number,
): AsyncIterable<Uint8Array> {
  let size = 0;

  for await (const chunk of raw) {
    size += chunk.byteLength;

    if (size > maxMessageSize) {
      throw new InboundEmailParseError(
        "message_too_large",
        "The inbound email exceeds the configured message size limit.",
      );
    }

    yield chunk;
  }
}

function asyncIterableToReadableStream(raw: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = raw[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await iterator.next();

        if (result.done) {
          controller.close();
          return;
        }

        controller.enqueue(result.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      void iterator.return?.();
    },
  });
}

function normalizeParsedEmail(
  message: InboundEmail,
  email: Email,
  maxAttachmentSize: number,
): ParsedInboundEmail {
  const text = normalizeText(email.text) ?? normalizeText(htmlToText(email.html ?? ""));
  const html = textToSafeHtml(normalizeText(htmlToText(email.html ?? "")));

  return {
    from: mailboxAddress(email.from) ?? message.from,
    to: message.to,
    subject: normalizeText(email.subject),
    text,
    html,
    messageId: normalizeText(email.messageId) ?? message.messageId,
    date: normalizeText(email.date),
    attachments: email.attachments.map((attachment) =>
      normalizeAttachment(attachment, maxAttachmentSize),
    ),
  };
}

export async function parseInboundEmail(
  message: InboundEmail,
  options: Partial<EmailParsingLimits> = {},
): Promise<ParsedInboundEmail> {
  const limits: EmailParsingLimits = {
    ...defaultEmailParsingLimits,
    ...options,
  };
  assertLimits(limits);

  if (message.rawSize > limits.maxMessageSize) {
    throw new InboundEmailParseError(
      "message_too_large",
      "The inbound email exceeds the configured message size limit.",
    );
  }

  const parserOptions: PostalMimeOptions = {
    attachmentEncoding: "arraybuffer",
    maxHeadersSize: limits.maxHeadersSize,
    maxNestingDepth: limits.maxNestingDepth,
    maxRfc822NestingDepth: limits.maxRfc822NestingDepth,
  };

  try {
    const email = await PostalMime.parse(
      asyncIterableToReadableStream(limitRawMessage(message.raw, limits.maxMessageSize)),
      parserOptions,
    );

    return normalizeParsedEmail(message, email, limits.maxAttachmentSize);
  } catch (error) {
    if (error instanceof InboundEmailParseError) {
      throw error;
    }

    throw new InboundEmailParseError("malformed_message", "The inbound email could not be parsed.");
  }
}
