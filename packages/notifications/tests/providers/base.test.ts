import { afterEach, describe, expect, mock, test } from "bun:test";
import { NotificationHttpError } from "../../src/errors";
import type { SafeFetchInit } from "../../src/http";
import type {
  NotificationDeliveryOptions,
  NotificationPayload,
  NotificationResult,
} from "../../src/types";

const safeFetchMock = mock((_url: string, _init?: SafeFetchInit) =>
  Promise.resolve(new Response("ok", { status: 200 })),
);

mock.module("../../src/http", () => ({
  safeFetch: safeFetchMock,
}));

const { BaseProvider } = await import("../../src/providers/base");

class TestProvider extends BaseProvider {
  async send(
    _payload: NotificationPayload,
    _options?: NotificationDeliveryOptions,
  ): Promise<NotificationResult> {
    return { success: true, channel: "webhook" };
  }

  public testWithRetry<T>(fn: () => Promise<T>, options?: NotificationDeliveryOptions): Promise<T> {
    return this.withRetry(fn, options);
  }

  public testFetchWithTimeout(
    url: string,
    init?: RequestInit,
    timeout?: number,
  ): Promise<Response> {
    return this.fetchWithTimeout(url, init, timeout);
  }

  public override delay(ms: number): Promise<void> {
    return super.delay(ms);
  }
}

describe("BaseProvider", () => {
  afterEach(() => {
    safeFetchMock.mockClear();
    safeFetchMock.mockImplementation((_url: string, _init?: SafeFetchInit) =>
      Promise.resolve(new Response("ok", { status: 200 })),
    );
  });

  describe("constructor defaults", () => {
    test("uses default timeout of 10_000", () => {
      const provider = new TestProvider();
      expect(provider).toBeDefined();
    });

    test("custom options override defaults", () => {
      const provider = new TestProvider({
        timeout: 5000,
        retries: 3,
        retryDelay: 500,
      });
      expect(provider).toBeDefined();
    });
  });

  describe("withRetry", () => {
    test("no retries by default — fn fails once, error thrown immediately", async () => {
      const provider = new TestProvider();
      const fn = mock(() => Promise.reject(new Error("fail")));

      await expect(provider.testWithRetry(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("retries N times then throws final error", async () => {
      const provider = new TestProvider({ retries: 2, retryDelay: 1 });
      provider.delay = mock(() => Promise.resolve()) as typeof provider.delay;

      const fn = mock(() => Promise.reject(new Error("fail")));

      await expect(provider.testWithRetry(fn)).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("retries then succeeds on later attempt", async () => {
      const provider = new TestProvider({ retries: 2, retryDelay: 1 });
      provider.delay = mock(() => Promise.resolve()) as typeof provider.delay;

      let attempt = 0;
      const fn = mock(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(new Error("fail"));
        }
        return Promise.resolve("success");
      });

      const result = await provider.testWithRetry(fn);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("does not retry permanent HTTP failures", async () => {
      const provider = new TestProvider({ retries: 2, retryDelay: 1 });
      const delay = mock(() => Promise.resolve());
      provider.delay = delay as typeof provider.delay;
      const fn = mock(() => Promise.reject(new NotificationHttpError("not found", 404)));

      await expect(provider.testWithRetry(fn)).rejects.toThrow("not found");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(delay).not.toHaveBeenCalled();
    });

    test("backoff delay increases per attempt", async () => {
      const provider = new TestProvider({ retries: 2, retryDelay: 1000 });
      const delayCalls: number[] = [];
      provider.delay = mock((ms: number) => {
        delayCalls.push(ms);
        return Promise.resolve();
      }) as typeof provider.delay;

      const fn = mock(() => Promise.reject(new Error("fail")));
      await expect(provider.testWithRetry(fn)).rejects.toThrow("fail");

      expect(delayCalls).toHaveLength(2);
      expect(delayCalls[0]).toBeGreaterThanOrEqual(1000);
      expect(delayCalls[0]).toBeLessThan(1500);
      expect(delayCalls[1]).toBeGreaterThanOrEqual(2000);
      expect(delayCalls[1]).toBeLessThan(2500);
    });
  });

  describe("fetchWithTimeout", () => {
    test("returns response on success", async () => {
      const provider = new TestProvider({ timeout: 5000 });
      const res = await provider.testFetchWithTimeout("http://example.com");

      expect(res.status).toBe(200);
      expect(safeFetchMock).toHaveBeenCalledWith("http://example.com", {
        timeoutMs: 5000,
      });
    });

    test("throws timeout error when request exceeds timeout", async () => {
      safeFetchMock.mockImplementationOnce(() =>
        Promise.reject(new Error("Request timed out after 10ms")),
      );

      const provider = new TestProvider({ timeout: 10 });
      await expect(provider.testFetchWithTimeout("http://example.com")).rejects.toThrow(
        "Request timed out after 10ms",
      );
    });

    test("allows a per-call timeout override", async () => {
      const provider = new TestProvider({ timeout: 5000 });
      await provider.testFetchWithTimeout("http://example.com", undefined, 250);

      expect(safeFetchMock).toHaveBeenCalledWith("http://example.com", {
        timeoutMs: 250,
      });
    });

    test("propagates non-abort errors as-is", async () => {
      safeFetchMock.mockImplementationOnce(() => Promise.reject(new Error("network failure")));

      const provider = new TestProvider({ timeout: 5000 });
      await expect(provider.testFetchWithTimeout("http://example.com")).rejects.toThrow(
        "network failure",
      );
    });
  });
});
