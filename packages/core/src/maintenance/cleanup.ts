import type { Clock } from "../identity/ports";
import type { IdentityRecord } from "../identity/types";

import type { DeliveryMetadataMaintenanceRepository, IdentityMaintenanceRepository } from "./ports";

export const defaultCleanupPolicy = {
  batchSize: 100,
  expiredIdentityRetentionMs: 30 * 24 * 60 * 60 * 1000,
  deliveryMetadataRetentionMs: 30 * 24 * 60 * 60 * 1000,
  expiryReminderWindowMs: 0,
} as const;

export type CleanupPolicy = {
  [Key in keyof typeof defaultCleanupPolicy]: number;
};

export interface CleanupRunResult {
  expiredIdentityCount: number;
  deletedIdentityCount: number;
  deletedDeliveryMetadataCount: number;
  expiryReminderCount: number;
}

export type ExpiryReminder = (
  identity: IdentityRecord,
  reminderKey: string,
) => void | Promise<void>;

export interface ExpirationCleanupDependencies {
  readonly identityMaintenanceRepository: IdentityMaintenanceRepository;
  readonly deliveryMetadataMaintenanceRepository: DeliveryMetadataMaintenanceRepository;
  readonly clock?: Clock;
  readonly policy?: Partial<CleanupPolicy>;
  readonly onExpiryReminder?: ExpiryReminder;
}

const systemClock: Clock = {
  now: () => new Date(),
};

function validatePolicy(policy: CleanupPolicy): void {
  for (const value of Object.values(policy)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError("Cleanup policy values must be non-negative safe integers.");
    }
  }

  if (policy.batchSize === 0) {
    throw new TypeError("Cleanup policy batchSize must be greater than zero.");
  }
}

function reminderKey(identity: IdentityRecord): string {
  return `identity-expiry:${identity.id}:${identity.expiresAt?.toISOString()}`;
}

export class ExpirationCleanup {
  private readonly clock: Clock;
  private readonly policy: CleanupPolicy;

  constructor(private readonly dependencies: ExpirationCleanupDependencies) {
    this.clock = dependencies.clock ?? systemClock;
    this.policy = {
      ...defaultCleanupPolicy,
      ...dependencies.policy,
    };
    validatePolicy(this.policy);
  }

  async run(): Promise<CleanupRunResult> {
    const now = this.clock.now();
    const expiryReminderCount = await this.sendExpiryReminders(now);
    const expiringIdentities =
      await this.dependencies.identityMaintenanceRepository.listActiveExpiringBefore(
        now,
        this.policy.batchSize,
      );
    let expiredIdentityCount = 0;

    for (const identity of expiringIdentities) {
      if (
        identity.status === "active" &&
        identity.expiresAt !== null &&
        identity.expiresAt <= now
      ) {
        if (await this.dependencies.identityMaintenanceRepository.expire(identity.id, now)) {
          expiredIdentityCount += 1;
        }
      }
    }

    const identityCutoff = new Date(now.getTime() - this.policy.expiredIdentityRetentionMs);
    const deliveryMetadataCutoff = new Date(
      now.getTime() - this.policy.deliveryMetadataRetentionMs,
    );

    return {
      expiredIdentityCount,
      deletedIdentityCount:
        await this.dependencies.identityMaintenanceRepository.deleteExpiredBefore(
          identityCutoff,
          this.policy.batchSize,
        ),
      deletedDeliveryMetadataCount:
        await this.dependencies.deliveryMetadataMaintenanceRepository.deleteCompletedBefore(
          deliveryMetadataCutoff,
          this.policy.batchSize,
        ),
      expiryReminderCount,
    };
  }

  private async sendExpiryReminders(now: Date): Promise<number> {
    const onExpiryReminder = this.dependencies.onExpiryReminder;
    const windowMs = this.policy.expiryReminderWindowMs;

    if (!onExpiryReminder || windowMs === 0) {
      return 0;
    }

    const reminderCutoff = new Date(now.getTime() + windowMs);
    const candidates =
      await this.dependencies.identityMaintenanceRepository.listActiveExpiringBefore(
        reminderCutoff,
        this.policy.batchSize,
      );
    const reminders = candidates.filter(
      (identity) => identity.expiresAt !== null && identity.expiresAt > now,
    );

    await Promise.all(
      reminders.map((identity) => onExpiryReminder(identity, reminderKey(identity))),
    );

    return reminders.length;
  }
}
