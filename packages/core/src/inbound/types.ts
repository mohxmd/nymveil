/**
 * Runtime-neutral representation of an inbound email event.
 *
 * The raw message is intentionally one-shot. Consumers should parse it while
 * handling the event and must not assume that it can be replayed.
 */
export interface InboundEmail {
  readonly from: string;
  readonly to: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly messageId: string | null;
  readonly raw: AsyncIterable<Uint8Array>;
  readonly rawSize: number;
}

export interface InboundEmailAttachment {
  readonly filename: string | null;
  readonly mimeType: string;
  readonly disposition: "attachment" | "inline" | null;
  readonly contentId: string | null;
  readonly size: number;
}

/**
 * Parsed content passed to routing and delivery orchestration.
 *
 * Attachment bytes are intentionally not part of this contract. Providers
 * receive metadata or explicitly selected content through a later policy.
 */
export interface ParsedInboundEmail {
  readonly from: string;
  readonly to: string;
  readonly subject: string | null;
  readonly text: string | null;
  /** Safe text-only HTML containing escaped text and optional <br> elements. */
  readonly html: string | null;
  readonly messageId: string | null;
  readonly date: string | null;
  readonly attachments: readonly InboundEmailAttachment[];
}

export interface InboundEmailProcessor {
  process(message: InboundEmail): void | Promise<void>;
}
