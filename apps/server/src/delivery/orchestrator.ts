import {
  DeliveryKeyConflictError,
  type Clock,
  type DeliveryAttemptRecord,
  type DeliveryAttemptRepository,
  type DestinationRecord,
} from "@nymveil/core";
import type { NotificationResult } from "@nymveil/notifications";

import type { NymveilDeliveryEvent, NymveilNotificationDispatcher } from "./notifications";

const supportedNotificationChannels = ["discord", "telegram"] as const;

type SupportedNotificationChannel = (typeof supportedNotificationChannels)[number];

export type DeliveryOutcomeStatus = "succeeded" | "failed" | "duplicate";
export type DeliveryOverallStatus = "succeeded" | "partially_failed" | "failed" | "deduplicated";

export interface NymveilDeliveryRequest extends NymveilDeliveryEvent {
  /** Stable source event id, normally derived from Message-ID or an event id. */
  eventId: string;
  identityId: string;
}

export interface DeliveryOutcome {
  destinationId: string;
  provider: DestinationRecord["provider"];
  status: DeliveryOutcomeStatus;
  attempt: DeliveryAttemptRecord | null;
}

export interface DeliveryOrchestrationResult {
  status: DeliveryOverallStatus;
  outcomes: DeliveryOutcome[];
}

export interface DeliveryOrchestratorDependencies {
  readonly attemptRepository: DeliveryAttemptRepository;
  readonly notificationDispatcher: NymveilNotificationDispatcher;
  readonly clock?: Clock;
  readonly idGenerator?: { generate(): string };
}

type ResolvedDeliveryDependencies = {
  readonly attemptRepository: DeliveryAttemptRepository;
  readonly notificationDispatcher: NymveilNotificationDispatcher;
  readonly clock: Clock;
  readonly idGenerator: { generate(): string };
};

const systemClock: Clock = {
  now: () => new Date(),
};

const randomIdGenerator = {
  generate: () => crypto.randomUUID(),
};

function isSupportedNotificationChannel(
  provider: DestinationRecord["provider"],
): provider is SupportedNotificationChannel {
  return (supportedNotificationChannels as readonly string[]).includes(provider);
}

function deliveryKey(eventId: string, destinationId: string): string {
  return `${eventId}:${destinationId}`;
}

function failureCode(result: NotificationResult): DeliveryAttemptRecord["errorCode"] {
  const error = result.error?.toLowerCase() ?? "";

  if (error.includes("not configured") || error.includes("configuration")) {
    return "configuration_error";
  }
  if (error.includes("rate") || error.includes("429")) {
    return "provider_rate_limited";
  }
  if (error.includes("timeout")) {
    return "provider_timeout";
  }
  if (error.includes("unavailable") || error.includes("503")) {
    return "provider_unavailable";
  }
  if (error.includes("reject") || error.includes("invalid")) {
    return "provider_rejected";
  }

  return "transport_error";
}

function failureAttempt(
  attempt: DeliveryAttemptRecord,
  errorCode: DeliveryAttemptRecord["errorCode"],
  now: Date,
): DeliveryAttemptRecord {
  return {
    ...attempt,
    status: "failed",
    completedAt: now,
    errorCode,
    updatedAt: now,
  };
}

function successAttempt(attempt: DeliveryAttemptRecord, now: Date): DeliveryAttemptRecord {
  return {
    ...attempt,
    status: "succeeded",
    completedAt: now,
    errorCode: null,
    updatedAt: now,
  };
}

function overallStatus(outcomes: DeliveryOutcome[]): DeliveryOverallStatus {
  if (outcomes.length === 0) {
    return "failed";
  }

  if (outcomes.every((outcome) => outcome.status === "duplicate")) {
    return "deduplicated";
  }

  const succeeded = outcomes.some((outcome) => outcome.status === "succeeded");
  const failed = outcomes.some((outcome) => outcome.status === "failed");

  if (succeeded && failed) {
    return "partially_failed";
  }
  if (succeeded) {
    return "succeeded";
  }

  return "failed";
}

export function createDeliveryOrchestrator({
  attemptRepository,
  notificationDispatcher,
  clock = systemClock,
  idGenerator = randomIdGenerator,
}: DeliveryOrchestratorDependencies) {
  return {
    async deliver(
      event: NymveilDeliveryRequest,
      destinations: readonly DestinationRecord[],
    ): Promise<DeliveryOrchestrationResult> {
      const outcomes = await Promise.all(
        destinations.map((destination) =>
          deliverToDestination({
            attemptRepository,
            clock,
            destination,
            event,
            idGenerator,
            notificationDispatcher,
          }),
        ),
      );

      return {
        status: overallStatus(outcomes),
        outcomes,
      };
    },
  };
}

async function deliverToDestination({
  attemptRepository,
  clock,
  destination,
  event,
  idGenerator,
  notificationDispatcher,
}: ResolvedDeliveryDependencies & {
  destination: DestinationRecord;
  event: NymveilDeliveryRequest;
  idGenerator: { generate(): string };
}): Promise<DeliveryOutcome> {
  const key = deliveryKey(event.eventId, destination.id);
  const existing = await attemptRepository.findByDeliveryKey(key);

  if (existing) {
    return {
      destinationId: destination.id,
      provider: destination.provider,
      status: "duplicate",
      attempt: existing,
    };
  }

  const startedAt = clock.now();
  const pending: DeliveryAttemptRecord = {
    id: idGenerator.generate(),
    deliveryKey: key,
    userId: destination.userId,
    identityId: event.identityId,
    destinationId: destination.id,
    provider: destination.provider,
    status: "pending",
    attemptedAt: startedAt,
    completedAt: null,
    errorCode: null,
    createdAt: startedAt,
    updatedAt: startedAt,
  };

  let attempt: DeliveryAttemptRecord;

  try {
    attempt = await attemptRepository.create(pending);
  } catch (error) {
    if (error instanceof DeliveryKeyConflictError) {
      const concurrentAttempt = await attemptRepository.findByDeliveryKey(key);

      if (concurrentAttempt) {
        return {
          destinationId: destination.id,
          provider: destination.provider,
          status: "duplicate",
          attempt: concurrentAttempt,
        };
      }
    }

    return {
      destinationId: destination.id,
      provider: destination.provider,
      status: "failed",
      attempt: null,
    };
  }

  if (destination.provider === "dashboard") {
    const succeeded = await attemptRepository.update(successAttempt(attempt, clock.now()));

    return {
      destinationId: destination.id,
      provider: destination.provider,
      status: "succeeded",
      attempt: succeeded,
    };
  }

  if (!isSupportedNotificationChannel(destination.provider)) {
    const failed = failureAttempt(attempt, "configuration_error", clock.now());
    const updated = await attemptRepository.update(failed);

    return {
      destinationId: destination.id,
      provider: destination.provider,
      status: "failed",
      attempt: updated,
    };
  }

  try {
    const results = await notificationDispatcher.dispatch(event, destination);
    const result = results[0];

    if (!result || !result.success) {
      const failed = failureAttempt(
        attempt,
        result ? failureCode(result) : "provider_rejected",
        clock.now(),
      );
      const updated = await attemptRepository.update(failed);

      return {
        destinationId: destination.id,
        provider: destination.provider,
        status: "failed",
        attempt: updated,
      };
    }

    const succeeded = await attemptRepository.update(successAttempt(attempt, clock.now()));

    return {
      destinationId: destination.id,
      provider: destination.provider,
      status: "succeeded",
      attempt: succeeded,
    };
  } catch {
    const failed = failureAttempt(attempt, "transport_error", clock.now());
    const updated = await attemptRepository.update(failed);

    return {
      destinationId: destination.id,
      provider: destination.provider,
      status: "failed",
      attempt: updated,
    };
  }
}
