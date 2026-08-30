import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import type { InboundEmail, InboundEmailProcessor } from "@nymveil/core";

export type CloudflareEmailHandler = (
  message: ForwardableEmailMessage,
  env?: unknown,
  ctx?: unknown,
) => void | Promise<void>;

export type CloudflareEmailAdapterErrorCode = "invalid_recipient" | "invalid_raw_size";

export class CloudflareEmailAdapterError extends Error {
  constructor(
    readonly code: CloudflareEmailAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CloudflareEmailAdapterError";
  }
}

function normalizeEnvelopeAddress(value: string, field: "from" | "to"): string {
  const normalized = value.trim().toLowerCase();

  // An empty MAIL FROM is valid for bounce messages, but the recipient is
  // required for identity lookup and cannot be processed without one.
  if (field === "to" && normalized.length === 0) {
    throw new CloudflareEmailAdapterError(
      "invalid_recipient",
      "The inbound email recipient is required.",
    );
  }

  return normalized;
}

function normalizeHeaders(headers: Headers): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};

  headers.forEach((value, name) => {
    normalized[name.toLowerCase()] = value.trim();
  });

  return normalized;
}

function normalizeRawSize(rawSize: number): number {
  if (!Number.isSafeInteger(rawSize) || rawSize < 0) {
    throw new CloudflareEmailAdapterError(
      "invalid_raw_size",
      "The inbound email raw size must be a non-negative safe integer.",
    );
  }

  return rawSize;
}

async function* readableStreamToAsyncIterable(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();

  try {
    while (true) {
      const result = await reader.read();

      if (result.done) {
        return;
      }

      if (result.value.byteLength > 0) {
        yield result.value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function normalizeCloudflareEmailMessage(message: ForwardableEmailMessage): InboundEmail {
  const headers = normalizeHeaders(message.headers);
  const messageId = headers["message-id"] || null;

  return {
    from: normalizeEnvelopeAddress(message.from, "from"),
    to: normalizeEnvelopeAddress(message.to, "to"),
    headers,
    messageId,
    raw: readableStreamToAsyncIterable(message.raw),
    rawSize: normalizeRawSize(message.rawSize),
  };
}

export function createCloudflareEmailHandler(
  processor: InboundEmailProcessor,
): CloudflareEmailHandler {
  return async (message: ForwardableEmailMessage): Promise<void> => {
    await processor.process(normalizeCloudflareEmailMessage(message));
  };
}
