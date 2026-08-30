import type {
  Clock,
  DestinationRecord,
  InboundEmail,
  InboundEmailProcessor,
  InboundRoutingDecision,
} from "@nymveil/core";

import type { NymveilDeliveryRequest } from "../delivery/orchestrator";
import { parseInboundEmail, type EmailParsingLimits, InboundEmailParseError } from "./parser";

export interface InboundRoutingPort {
  route(input: { recipient: string }): Promise<InboundRoutingDecision>;
}

export interface InboundDeliveryPort {
  deliver(
    event: NymveilDeliveryRequest,
    destinations: readonly DestinationRecord[],
  ): Promise<unknown>;
}

export interface InboundEmailProcessorDependencies {
  readonly routing: InboundRoutingPort;
  readonly delivery: InboundDeliveryPort;
  readonly clock?: Clock;
  readonly parsingLimits?: Partial<EmailParsingLimits>;
}

const systemClock: Clock = {
  now: () => new Date(),
};

function eventId(message: InboundEmail, parsedMessageId: string | null): string {
  return parsedMessageId ?? message.messageId ?? `no-message-id:${message.to}:${message.rawSize}`;
}

function deliveryEvent(
  message: InboundEmail,
  parsed: Awaited<ReturnType<typeof parseInboundEmail>>,
  decision: Extract<InboundRoutingDecision, { accepted: true }>,
  clock: Clock,
): NymveilDeliveryRequest {
  return {
    eventId: eventId(message, parsed.messageId),
    identityId: decision.identity.id,
    identityAddress: decision.identity.address,
    identityLabel: decision.identity.label,
    receivedAt: clock.now(),
    sender: parsed.from || null,
    subject: parsed.subject,
  };
}

export function createInboundEmailProcessor({
  routing,
  delivery,
  clock = systemClock,
  parsingLimits,
}: InboundEmailProcessorDependencies): InboundEmailProcessor {
  return {
    async process(message) {
      const decision = await routing.route({ recipient: message.to });

      // Unknown, expired, torched, and otherwise unusable recipients are
      // discarded before consuming or parsing untrusted message content.
      if (!decision.accepted) {
        return;
      }

      let parsed;

      try {
        parsed = await parseInboundEmail(message, parsingLimits);
      } catch (error) {
        // Invalid inbound content is expected input, not a Worker failure.
        // Infrastructure failures still propagate for runtime observability.
        if (error instanceof InboundEmailParseError) {
          return;
        }

        throw error;
      }

      await delivery.deliver(
        deliveryEvent(message, parsed, decision, clock),
        decision.destinations,
      );
    },
  };
}
