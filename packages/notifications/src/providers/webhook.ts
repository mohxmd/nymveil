import { type SafeFetchInit, UrlValidationError } from "../http";
import { NotificationHttpError } from "../errors";
import type {
  NotificationDeliveryOptions,
  NotificationPayload,
  NotificationResult,
} from "../types";
import { BaseProvider } from "./base";

const FORBIDDEN_WEBHOOK_HEADERS = new Set([
  "authorization",
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "host",
  "transfer-encoding",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-original-url",
  "x-real-ip",
]);
const CRLF_PATTERN = /[\r\n]/;

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name, value]) =>
        !FORBIDDEN_WEBHOOK_HEADERS.has(name.toLowerCase()) &&
        !CRLF_PATTERN.test(name) &&
        !CRLF_PATTERN.test(value),
    ),
  );
}

export interface WebhookProviderConfig {
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH";
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  transformPayloadAction?: (payload: NotificationPayload) => unknown;
  url: string;
}

export class WebhookProvider extends BaseProvider {
  private readonly url: string;
  private readonly method: "GET" | "POST" | "PUT" | "PATCH";
  private readonly headers?: Record<string, string>;
  private readonly transformPayloadAction?: (payload: NotificationPayload) => unknown;

  constructor(config: WebhookProviderConfig) {
    super({
      timeout: config.timeout,
      retries: config.retries,
      retryDelay: config.retryDelay,
    });
    this.url = config.url;
    this.method = config.method ?? "POST";
    this.headers = config.headers;
    this.transformPayloadAction = config.transformPayloadAction;
  }

  async send(
    payload: NotificationPayload,
    options?: NotificationDeliveryOptions,
  ): Promise<NotificationResult> {
    if (!this.url) {
      return {
        success: false,
        channel: "webhook",
        error: "Webhook URL not configured",
      };
    }

    try {
      const body = this.transformPayloadAction ? this.transformPayloadAction(payload) : payload;

      const init: SafeFetchInit = {
        method: this.method,
        headers: {
          "Content-Type": "application/json",
          ...sanitizeHeaders(this.headers),
        },
      };

      if (this.method !== "GET" && body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const response = await this.withRetry(async () => {
        const res = await this.fetchWithTimeout(this.url, init, options?.timeout);

        if (!res.ok) {
          const text = await res.text().catch(() => "Unable to read response");
          throw new NotificationHttpError(
            `Webhook error: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`,
            res.status,
          );
        }

        return res;
      }, options);

      const data = await response.json().catch(() => null);

      return {
        success: true,
        channel: "webhook",
        response: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
      };
    } catch (error) {
      const message =
        error instanceof UrlValidationError
          ? `Webhook URL blocked: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      return {
        success: false,
        channel: "webhook",
        error: message,
      };
    }
  }
}
