import type { DestinationProvider } from "../destination/types";

export const deliveryAttemptStatuses = ["pending", "succeeded", "failed"] as const;

export type DeliveryAttemptStatus = (typeof deliveryAttemptStatuses)[number];

export const deliveryFailureCodes = [
  "configuration_error",
  "provider_rejected",
  "provider_rate_limited",
  "provider_timeout",
  "provider_unavailable",
  "transport_error",
  "unknown",
] as const;

export type DeliveryFailureCode = (typeof deliveryFailureCodes)[number];

export interface DeliveryAttemptRecord {
  id: string;
  /** Stable event-and-destination key used to prevent duplicate delivery. */
  deliveryKey: string;
  userId: string;
  identityId: string;
  destinationId: string;
  provider: DestinationProvider;
  status: DeliveryAttemptStatus;
  attemptedAt: Date;
  completedAt: Date | null;
  /** Bounded, provider-neutral error category; never raw provider output. */
  errorCode: DeliveryFailureCode | null;
  createdAt: Date;
  updatedAt: Date;
}
