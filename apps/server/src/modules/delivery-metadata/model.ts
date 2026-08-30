import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });
const failureCode = z.enum([
  "configuration_error",
  "provider_rejected",
  "provider_rate_limited",
  "provider_timeout",
  "provider_unavailable",
  "transport_error",
  "unknown",
]);

const deliveryAttempt = z.object({
  id: z.string(),
  identityId: z.string(),
  destinationId: z.string(),
  provider: z.string().min(1),
  status: z.enum(["pending", "succeeded", "failed"]),
  attemptedAt: timestamp,
  completedAt: timestamp.nullable(),
  errorCode: failureCode.nullable(),
});

export const DeliveryMetadataModel = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
  listResponse: z.object({
    attempts: z.array(deliveryAttempt),
  }),
} as const;

export type DeliveryMetadataModel = {
  [K in keyof typeof DeliveryMetadataModel]: z.infer<(typeof DeliveryMetadataModel)[K]>;
};
