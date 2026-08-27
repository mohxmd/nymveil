import { afterEach, describe, expect, mock, test } from "bun:test";
import type { SafeFetchInit } from "../../src/http";

const safeFetchMock = mock((_url: string, _init?: SafeFetchInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
);

mock.module("../../src/http", () => ({
  safeFetch: safeFetchMock,
}));

const { buildDiscordEmbed, DiscordProvider } = await import("../../src/providers/discord");

describe("buildDiscordEmbed", () => {
  test("hides internal metadata and keeps user-facing fields", () => {
    const embed = buildDiscordEmbed({
      title: "Delivery alert",
      message: "A delivery event occurred.",
      metadata: {
        detailsUrl: "https://example.com/details/1",
        internalId: "internal-resource-id",
      },
    });

    expect(embed.fields).toHaveLength(1);
    expect(embed.fields?.[0]?.name).toBe("Details Url");
    expect(JSON.stringify(embed)).not.toContain("internal-resource-id");
  });

  test("bounds title and description length before calling Discord", () => {
    const embed = buildDiscordEmbed({
      title: "T".repeat(400),
      message: "M".repeat(5000),
    });

    expect(embed.title?.length).toBe(256);
    expect(embed.description?.length).toBe(4096);
  });

  test("caps fields at Discord's 25-field embed limit", () => {
    const embed = buildDiscordEmbed({
      title: "Notification received",
      message: "A notification is ready.",
      metadata: Object.fromEntries(
        Array.from({ length: 100 }, (_, index) => [`field${index}`, index]),
      ),
    });

    expect(embed.fields).toHaveLength(25);
  });

  test("stops adding fields before the 6000-character aggregate embed limit", () => {
    const embed = buildDiscordEmbed({
      title: "Notification received",
      message: "M".repeat(4096),
      metadata: Object.fromEntries(
        Array.from({ length: 25 }, (_, index) => [`field${index}`, "V".repeat(1024)]),
      ),
    });

    const total =
      (embed.title?.length ?? 0) +
      (embed.description?.length ?? 0) +
      (embed.footer?.text.length ?? 0) +
      (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0);

    expect(embed.fields?.length ?? 0).toBeLessThan(25);
    expect(total).toBeLessThanOrEqual(6000);
  });

  test("only surfaces a color and priority footer for elevated priority", () => {
    const normal = buildDiscordEmbed({
      title: "Delivery alert",
      message: "A delivery event failed.",
      priority: "normal",
    });
    expect(normal.color).toBeUndefined();
    expect(normal.footer).toBeUndefined();

    const urgent = buildDiscordEmbed({
      title: "Delivery alert",
      message: "A delivery event failed.",
      priority: "urgent",
    });
    expect(urgent.color).toBeDefined();
    expect(urgent.footer?.text).toBe("Priority: URGENT");
  });
});

describe("DiscordProvider", () => {
  afterEach(() => {
    safeFetchMock.mockClear();
    safeFetchMock.mockImplementation((_url: string, _init?: SafeFetchInit) =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
  });

  test("returns a failed result when no webhook URL is configured", async () => {
    const provider = new DiscordProvider({ webhookUrl: "" });
    const result = await provider.send({ title: "t", message: "m" });

    expect(result).toEqual({
      success: false,
      channel: "discord",
      error: "Discord webhook URL not configured",
    });
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  test("posts an embed payload and reports success on a 204 response", async () => {
    const provider = new DiscordProvider({
      webhookUrl: "https://discord.com/api/webhooks/123/token",
    });

    const result = await provider.send({
      title: "Delivery alert",
      message: "A delivery event failed.",
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("discord");
    expect(safeFetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = safeFetchMock.mock.calls[0] as [string, SafeFetchInit];
    expect(url).toBe("https://discord.com/api/webhooks/123/token");
    const body = JSON.parse(init.body as string);
    expect(body.embeds[0].title).toBe("Delivery alert");
  });

  test("returns a failed result when Discord responds with an error status", async () => {
    safeFetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response("invalid webhook", { status: 404 })),
    );

    const provider = new DiscordProvider({
      webhookUrl: "https://discord.com/api/webhooks/123/token",
    });

    const result = await provider.send({ title: "t", message: "m" });

    expect(result.success).toBe(false);
    expect(result.channel).toBe("discord");
    expect(result.error).toContain("Discord API error: 404");
  });
});
