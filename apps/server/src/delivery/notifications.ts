import {
  NotificationClient,
  type NotificationClientConfig,
  type NotificationPayload,
  type NotificationResult,
} from "@nymveil/notifications";
import type { DestinationRecord } from "@nymveil/core";
import { z } from "zod";

const notificationConfigSchema = z.object({
  defaultRetries: z.number().int().nonnegative().optional(),
  defaultRetryDelay: z.number().int().nonnegative().optional(),
  defaultTimeout: z.number().int().positive().optional(),
  discord: z
    .object({
      webhookUrl: z.url(),
      username: z.string().trim().min(1).optional(),
    })
    .optional(),
  telegram: z
    .object({
      botToken: z.string().trim().min(1),
      chatId: z.union([z.string().trim().min(1), z.number().int()]),
    })
    .optional(),
});

export type NymveilNotificationConfig = z.infer<typeof notificationConfigSchema>;
export type NymveilNotificationChannel = "discord" | "telegram";

export interface NymveilDeliveryEvent {
  identityAddress: string;
  identityLabel: string;
  receivedAt: Date;
  sender?: string | null;
  subject?: string | null;
}

export interface NymveilNotificationDispatcher {
  dispatch(
    event: NymveilDeliveryEvent,
    destination: DestinationRecord,
  ): Promise<NotificationResult[]>;
}

export type NymveilNotificationClientResolver = (
  destination: DestinationRecord,
) => Promise<Pick<NotificationClient, "send"> | null>;

export function parseNotificationConfig(input: unknown): NymveilNotificationConfig {
  return notificationConfigSchema.parse(input);
}

export function createNymveilNotificationClient(input: unknown): NotificationClient {
  const config = parseNotificationConfig(input) satisfies NotificationClientConfig;
  return new NotificationClient(config);
}

export function createNymveilNotificationDispatcher(
  resolveClient: NymveilNotificationClientResolver,
): NymveilNotificationDispatcher {
  return {
    async dispatch(event, destination) {
      const client = await resolveClient(destination);
      if (!client) {
        return [
          {
            success: false,
            channel: destination.provider,
            error: `Provider for channel '${destination.provider}' is not configured`,
          },
        ];
      }

      return client.send(toNotificationPayload(event), { channels: [destination.provider] });
    },
  };
}

export function toNotificationPayload(event: NymveilDeliveryEvent): NotificationPayload {
  return {
    title: "New email received",
    message: `A message was received for ${event.identityLabel} (${event.identityAddress}).`,
    metadata: {
      address: event.identityAddress,
      ...(event.sender ? { sender: event.sender } : {}),
      ...(event.subject ? { subject: event.subject } : {}),
      receivedAt: event.receivedAt.toISOString(),
    },
  };
}
