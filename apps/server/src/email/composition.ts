import type { InboundEmailProcessor } from "@nymveil/core";

import { createCloudflareEmailHandler, type CloudflareEmailHandler } from "./cloudflare-adapter";
import {
  createInboundEmailProcessor,
  type InboundDeliveryPort,
  type InboundRoutingPort,
} from "./processor";

export interface InboundEmailHandlerDependencies {
  readonly routing: InboundRoutingPort;
  readonly delivery: InboundDeliveryPort;
}

export function createInboundEmailHandler({
  routing,
  delivery,
}: InboundEmailHandlerDependencies): CloudflareEmailHandler {
  const processor: InboundEmailProcessor = createInboundEmailProcessor({ routing, delivery });

  return createCloudflareEmailHandler(processor);
}
