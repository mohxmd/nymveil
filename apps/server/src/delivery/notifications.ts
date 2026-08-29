import {
  NoNotificationChannelsError,
  NotificationClient,
  type NotificationClientConfig,
  type NotificationPayload,
  type NotificationResult,
} from "@nymveil/notifications";
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
    channels: readonly NymveilNotificationChannel[],
  ): Promise<NotificationResult[]>;
}

export function parseNotificationConfig(input: unknown): NymveilNotificationConfig {
  return notificationConfigSchema.parse(input);
}

export function createNymveilNotificationClient(input: unknown): NotificationClient {
  const config = parseNotificationConfig(input) satisfies NotificationClientConfig;
  return new NotificationClient(config);
}

export function createNymveilNotificationDispatcher(
  client: Pick<NotificationClient, "send">,
): NymveilNotificationDispatcher {
  return {
    async dispatch(event, channels) {
      const selectedChannels = [...new Set(channels)];

      if (selectedChannels.length === 0) {
        throw new NoNotificationChannelsError();
      }

      return client.send(toNotificationPayload(event), { channels: selectedChannels });
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
