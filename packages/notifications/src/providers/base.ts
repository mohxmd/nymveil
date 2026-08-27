import { NotificationHttpError } from "../errors";
import { safeFetch, UrlValidationError, type SafeFetchInit } from "../http";
import type {
  NotificationDeliveryOptions,
  NotificationPayload,
  NotificationResult,
} from "../types";

export interface NotificationProvider {
  send(
    payload: NotificationPayload,
    options?: NotificationDeliveryOptions,
  ): Promise<NotificationResult>;
}

export abstract class BaseProvider implements NotificationProvider {
  protected timeout: number;
  protected retries: number;
  protected retryDelay: number;

  constructor(options?: NotificationDeliveryOptions) {
    this.timeout = options?.timeout ?? 10_000;
    this.retries = options?.retries ?? 0;
    this.retryDelay = options?.retryDelay ?? 1000;
  }

  abstract send(
    payload: NotificationPayload,
    options?: NotificationDeliveryOptions,
  ): Promise<NotificationResult>;

  protected async withRetry<T>(
    fn: () => Promise<T>,
    options?: NotificationDeliveryOptions,
    attempt = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const retries = options?.retries ?? this.retries;
      if (attempt < retries && isRetryableError(error)) {
        const retryDelay = options?.retryDelay ?? this.retryDelay;
        const backoff = retryDelay * 2 ** attempt + Math.random() * 500;
        await this.delay(backoff);
        return this.withRetry(fn, options, attempt + 1);
      }
      throw error;
    }
  }

  protected fetchWithTimeout(
    url: string,
    init?: Omit<SafeFetchInit, "timeoutMs">,
    timeout?: number,
  ): Promise<Response> {
    return safeFetch(url, { ...init, timeoutMs: timeout ?? this.timeout });
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof UrlValidationError) {
    return false;
  }

  if (error instanceof NotificationHttpError) {
    return (
      error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500
    );
  }

  return true;
}
