import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

const attempt = z.object({
  id: z.string(),
  identityId: z.string(),
  destinationId: z.string(),
  provider: z.string().min(1),
  status: z.enum(["pending", "succeeded", "failed"]),
  attemptedAt: timestamp,
  completedAt: timestamp.nullable(),
  errorCode: z
    .enum([
      "configuration_error",
      "provider_rejected",
      "provider_rate_limited",
      "provider_timeout",
      "provider_unavailable",
      "transport_error",
      "unknown",
    ])
    .nullable(),
});

export const deliveryAttemptListResponseSchema = z.object({
  attempts: z.array(attempt),
});
