import { z } from "zod";

const discordWebhookUrl = z.url().refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"].includes(
        url.hostname,
      ) && url.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}, "A Discord webhook URL is required.");

export const discordDestinationConfiguration = z.object({
  webhookUrl: discordWebhookUrl,
  username: z.string().trim().min(1).max(80).optional(),
});

export const telegramDestinationConfiguration = z.object({
  botToken: z.string().trim().min(1).max(512),
  disableNotification: z.boolean().optional(),
  messageThreadId: z.number().int().nonnegative().optional(),
  parseMode: z.enum(["HTML", "MarkdownV2"]).optional(),
  protectContent: z.boolean().optional(),
});
