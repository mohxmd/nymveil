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

export interface InboundEmailProcessor {
  process(message: InboundEmail): void | Promise<void>;
}
