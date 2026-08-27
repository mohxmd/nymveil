import { NotificationHttpError } from "../errors";
import type {
  NotificationDeliveryOptions,
  NotificationPayload,
  NotificationResult,
  TelegramParseMode,
  TelegramPayload,
} from "../types";
import { BaseProvider } from "./base";
import { formatMetadataLabel, isUserFacingMetadata, truncate } from "./payload-utils";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org/bot";
const MAX_MESSAGE_LENGTH = 4096;

interface TelegramProviderResponse {
  description?: string;
  error_code?: number;
  ok: boolean;
  result?: unknown;
}

export interface TelegramProviderConfig {
  botToken: string;
  chatId: number | string;
  disableNotification?: boolean;
  messageThreadId?: number;
  parseMode?: TelegramParseMode;
  protectContent?: boolean;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export function buildTelegramText(payload: NotificationPayload): string {
  const metadata = payload.metadata
    ? Object.entries(payload.metadata)
        .filter(([key]) => isUserFacingMetadata(key))
        .map(([key, value]) => `${formatMetadataLabel(key)}: ${String(value)}`)
    : [];
  const metadataText = metadata.length > 0 ? `\n\n${metadata.join("\n")}` : "";

  return truncate(`${payload.title}\n\n${payload.message}${metadataText}`, MAX_MESSAGE_LENGTH);
}

export class TelegramProvider extends BaseProvider {
  private readonly botToken: string;
  private readonly chatId: number | string;
  private readonly disableNotification?: boolean;
  private readonly messageThreadId?: number;
  private readonly parseMode?: TelegramParseMode;
  private readonly protectContent?: boolean;

  constructor(config: TelegramProviderConfig) {
    super({
      timeout: config.timeout,
      retries: config.retries,
      retryDelay: config.retryDelay,
    });
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.disableNotification = config.disableNotification;
    this.messageThreadId = config.messageThreadId;
    this.parseMode = config.parseMode;
    this.protectContent = config.protectContent;
  }

  async send(
    payload: NotificationPayload,
    options?: NotificationDeliveryOptions,
  ): Promise<NotificationResult> {
    if (!this.botToken) {
      return {
        success: false,
        channel: "telegram",
        error: "Telegram bot token not configured",
      };
    }

    try {
      const response = await this.withRetry(async () => {
        const res = await this.fetchWithTimeout(
          `${TELEGRAM_API_BASE_URL}${this.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(this.buildPayload(payload)),
          },
          options?.timeout,
        );
        const data = (await res.json().catch(() => null)) as TelegramProviderResponse | null;

        if (!res.ok || !data?.ok) {
          const status = data?.error_code ?? res.status;
          const description = data?.description ?? `${res.status} ${res.statusText}`;
          throw new NotificationHttpError(`Telegram API error: ${status} - ${description}`, status);
        }

        return { response: res, data };
      }, options);

      return {
        success: true,
        channel: "telegram",
        response: {
          status: response.response.status,
          statusText: response.response.statusText,
          data: response.data.result,
        },
      };
    } catch (error) {
      return {
        success: false,
        channel: "telegram",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildPayload(payload: NotificationPayload): TelegramPayload {
    return {
      chat_id: this.chatId,
      text: buildTelegramText(payload),
      ...(this.disableNotification !== undefined && {
        disable_notification: this.disableNotification,
      }),
      ...(this.messageThreadId !== undefined && { message_thread_id: this.messageThreadId }),
      ...(this.parseMode && { parse_mode: this.parseMode }),
      ...(this.protectContent !== undefined && { protect_content: this.protectContent }),
    };
  }
}
