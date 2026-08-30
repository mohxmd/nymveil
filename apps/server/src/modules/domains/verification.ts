import type {
  DomainChallengeHasher,
  DomainTokenGenerator,
  DomainVerificationCheck,
  DomainVerifier,
} from "@nymveil/core";

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function createDomainChallengeHasher(): DomainChallengeHasher {
  return {
    async hash(value) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return encodeBase64Url(new Uint8Array(digest));
    },

    async verify(value, expectedHash) {
      try {
        const actual = decodeBase64Url(await this.hash(value));
        const expected = decodeBase64Url(expectedHash);

        if (actual.byteLength !== expected.byteLength) return false;

        let difference = 0;
        for (let index = 0; index < actual.length; index += 1) {
          difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
        }

        return difference === 0;
      } catch {
        return false;
      }
    },
  };
}

export const domainTokenGenerator: DomainTokenGenerator = {
  generate() {
    return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  },
};

interface DnsAnswer {
  data?: string;
  type?: number;
}

interface DnsJsonResponse {
  Answer?: DnsAnswer[];
  Status?: number;
}

type DomainFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function txtValue(data: string): string {
  const chunks = [...data.matchAll(/"((?:\\.|[^"])*)"/g)].map((match) =>
    (match[1] ?? "").replaceAll('\\"', '"').replaceAll("\\\\", "\\"),
  );

  return chunks.length > 0 ? chunks.join("") : data;
}

export function createCloudflareDomainVerifier(fetcher: DomainFetcher = fetch): DomainVerifier {
  return {
    async verify(hostname, token): Promise<DomainVerificationCheck> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const url = new URL("https://cloudflare-dns.com/dns-query");
      url.searchParams.set("name", "_nymveil-challenge." + hostname);
      url.searchParams.set("type", "TXT");

      try {
        const response = await fetcher(url, {
          headers: { Accept: "application/dns-json" },
          signal: controller.signal,
        });
        if (!response.ok) return "unavailable";

        const body = (await response.json()) as DnsJsonResponse;
        if (body.Status === undefined) return "unavailable";

        const matches = (body.Answer ?? [])
          .filter((answer) => answer.type === 16 && answer.data)
          .some((answer) => txtValue(answer.data ?? "") === token);

        return matches ? "verified" : "not_found";
      } catch {
        return "unavailable";
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
