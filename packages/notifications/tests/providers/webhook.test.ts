import { afterEach, describe, expect, mock, test } from "bun:test";
import type { SafeFetchInit } from "../../src/http";

const safeFetchMock = mock((_url: string, _init?: SafeFetchInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
);

class MockUrlValidationError extends Error {}

mock.module("../../src/http", () => ({
  safeFetch: safeFetchMock,
  UrlValidationError: MockUrlValidationError,
}));

const { WebhookProvider } = await import("../../src/providers/webhook");

describe("WebhookProvider", () => {
  afterEach(() => {
    safeFetchMock.mockClear();
    safeFetchMock.mockImplementation((_url: string, _init?: SafeFetchInit) =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
  });

  test("sends falsy transformed bodies", async () => {
    const provider = new WebhookProvider({
      transformPayloadAction: () => false,
      url: "https://example.com/hooks",
    });

    const result = await provider.send({ title: "Delivery", message: "Ready" });
    const [, init] = safeFetchMock.mock.calls[0] as [string, SafeFetchInit];

    expect(result.success).toBe(true);
    expect(init.body).toBe("false");
  });

  test("removes unsafe webhook headers", async () => {
    const provider = new WebhookProvider({
      headers: {
        Authorization: "secret",
        "Content-Type": "text/plain",
        "X-Allowed": "value",
        "X-Bad": "line\nvalue",
      },
      url: "https://example.com/hooks",
    });

    await provider.send({ title: "Delivery", message: "Ready" });
    const [, init] = safeFetchMock.mock.calls[0] as [string, SafeFetchInit];

    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Allowed": "value",
    });
  });

  test("does not retry permanent HTTP failures", async () => {
    safeFetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response("invalid", { status: 404 })),
    );
    const provider = new WebhookProvider({
      retries: 2,
      retryDelay: 1,
      url: "https://example.com/hooks",
    });

    const result = await provider.send({ title: "Delivery", message: "Ready" });

    expect(result.success).toBe(false);
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });
});
