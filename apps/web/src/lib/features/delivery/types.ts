export type DeliveryAttemptStatus = "pending" | "succeeded" | "failed";

export type DeliveryFailureCode =
  | "configuration_error"
  | "provider_rejected"
  | "provider_rate_limited"
  | "provider_timeout"
  | "provider_unavailable"
  | "transport_error"
  | "unknown";

export interface DeliveryAttempt {
  id: string;
  identityId: string;
  destinationId: string;
  provider: string;
  status: DeliveryAttemptStatus;
  attemptedAt: string;
  completedAt: string | null;
  errorCode: DeliveryFailureCode | null;
}
