import { describe, expect, test } from "bun:test";

import {
  createCloudflareDomainVerifier,
  createDomainChallengeHasher,
} from "../src/modules/domains/verification";

describe("domain verification adapters", () => {
  test("hashes and verifies challenge tokens without storing the token", async () => {
    const hasher = createDomainChallengeHasher();
    const hash = await hasher.hash("token-one-123456");

    expect(hash).not.toContain("token-one-123456");
    expect(await hasher.verify("token-one-123456", hash)).toBe(true);
    expect(await hasher.verify("token-two-123456", hash)).toBe(false);
  });

  test("verifies a matching TXT answer", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        "https://cloudflare-dns.com/dns-query?name=_nymveil-challenge.example.com&type=TXT",
      );
      expect(init?.headers).toEqual({ Accept: "application/dns-json" });
      return new Response(
        JSON.stringify({ Status: 0, Answer: [{ type: 16, data: '"token-one-123456"' }] }),
      );
    };

    const verifier = createCloudflareDomainVerifier(fetcher);

    await expect(verifier.verify("example.com", "token-one-123456")).resolves.toBe("verified");
  });

  test("supports chunked TXT answers and reports missing records", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({ Status: 0, Answer: [{ type: 16, data: '"token-one-" "123456"' }] }),
      );

    const verifier = createCloudflareDomainVerifier(fetcher);

    await expect(verifier.verify("example.com", "token-one-123456")).resolves.toBe("verified");
    await expect(verifier.verify("example.com", "token-two-123456")).resolves.toBe("not_found");
  });

  test("reports resolver failures as unavailable", async () => {
    const verifier = createCloudflareDomainVerifier(async () => {
      throw new Error("network unavailable");
    });

    await expect(verifier.verify("example.com", "token-one-123456")).resolves.toBe("unavailable");
  });
});
