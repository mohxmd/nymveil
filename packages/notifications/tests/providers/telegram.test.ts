import { afterEach, describe, expect, mock, test } from "bun:test";
import type { SafeFetchInit } from "../../src/http";

const safeFetchMock = mock((_url: string, _init?: SafeFetchInit) =>
  Promise.resolve(
    new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ),
);

mock.module("../../src/http", () => ({
  safeFetch: safeFetchMock,
}));

const { buildTelegramText, TelegramProvider } = await import("../../src/providers/telegram");

describe("buildTelegramText", () => {
  test("combines the notification and excludes internal metadata", () => {
    const text = buildTelegramText({
      title: "Delivery alert",
      message: "A delivery event occurred.",
      metadata: {
        address: "alias@example.com",
        internalId: "internal-resource-id",
      },
    });

    expect(text).toContain("Delivery alert");
    expect(text).toContain("A delivery event occurred.");
    expect(text).toContain("Address: alias@example.com");
    expect(text).not.toContain("internal-resource-id");
  });

  test("keeps text within Telegram's message limit", () => {
    const text = buildTelegramText({
      title: "Delivery alert",
      message: "M".repeat(5000),
    });

    expect(text.length).toBe(4096);
  });
});

describe("TelegramProvider", () => {
  afterEach(() => {
    safeFetchMock.mockClear();
    safeFetchMock.mockImplementation((_url: string, _init?: SafeFetchInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  test("returns a failed result when the bot token is missing", async () => {
    const provider = new TelegramProvider({ botToken: "", chatId: "chat-123" });

    const result = await provider.send({ title: "Delivery", message: "Ready" });

    expect(result).toEqual({
      channel: "telegram",
      error: "Telegram bot token not configured",
      success: false,
    });
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  test("posts a message to the Telegram Bot API", async () => {
    const provider = new TelegramProvider({
      botToken: "123456:fake-token",
      chatId: "chat-123",
      disableNotification: true,
      messageThreadId: 42,
      parseMode: "HTML",
      protectContent: true,
    });

    const result = await provider.send({
      title: "Delivery alert",
      message: "A delivery event occurred.",
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("telegram");
    expect(safeFetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = safeFetchMock.mock.calls[0] as [string, SafeFetchInit];
    expect(url).toBe("https://api.telegram.org/bot123456:fake-token/sendMessage");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      chat_id: "chat-123",
      disable_notification: true,
      message_thread_id: 42,
      parse_mode: "HTML",
      protect_content: true,
      text: "Delivery alert\n\nA delivery event occurred.",
    });
  });

  test("does not retry permanent Telegram API failures", async () => {
    safeFetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request" }), {
          status: 400,
        }),
      ),
    );
    const provider = new TelegramProvider({
      botToken: "123456:fake-token",
      chatId: "chat-123",
      retries: 2,
      retryDelay: 1,
    });

    const result = await provider.send({ title: "Delivery", message: "Ready" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Telegram API error: 400 - Bad Request");
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });

  test("retries Telegram rate limits", async () => {
    safeFetchMock
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ ok: false, error_code: 429, description: "Too Many Requests" }),
            { status: 429 },
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: { message_id: 2 } }), {
            status: 200,
          }),
        ),
      );
    const provider = new TelegramProvider({
      botToken: "123456:fake-token",
      chatId: "chat-123",
      retries: 1,
      retryDelay: 0,
    });

    const result = await provider.send({ title: "Delivery", message: "Ready" });

    expect(result.success).toBe(true);
    expect(safeFetchMock).toHaveBeenCalledTimes(2);
  });
});
