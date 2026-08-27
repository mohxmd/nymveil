import { afterEach, describe, expect, mock, test } from "bun:test";
import { safeFetch, UrlValidationError } from "../src/http";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("safeFetch", () => {
  test("blocks private hosts before making a request", async () => {
    const fetchMock = mock(async () => new Response("ok"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(safeFetch("http://127.0.0.1/internal")).rejects.toBeInstanceOf(UrlValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not follow redirects by default", async () => {
    const fetchMock = mock(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/next" },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await safeFetch("https://example.com/start");

    expect(response.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("allows same-origin redirects when explicitly enabled", async () => {
    const fetchMock = mock(async (url: string) => {
      if (url.endsWith("/start")) {
        return new Response(null, {
          status: 302,
          headers: { location: "/next" },
        });
      }
      return new Response("ok", { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await safeFetch("https://example.com/start", {
      followRedirects: true,
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://example.com/next");
  });

  test("rejects cross-origin redirects", async () => {
    const fetchMock = mock(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://other.example/next" },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(safeFetch("https://example.com/start", { followRedirects: true })).rejects.toThrow(
      "Cross-origin redirects are not supported",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
