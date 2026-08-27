const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface SafeFetchInit extends Omit<RequestInit, "redirect" | "signal"> {
  followRedirects?: boolean;
  maxRedirects?: number;
  signal?: AbortSignal | null;
  timeoutMs?: number;
}

export class UrlValidationError extends Error {
  readonly hostname?: string;

  constructor(message: string, hostname?: string) {
    super(message);
    this.name = "UrlValidationError";
    this.hostname = hostname;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  const [first, second] = parts;
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    isPrivateIpv4(normalized) ||
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UrlValidationError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError("Only HTTP and HTTPS URLs are supported", parsed.hostname);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    isPrivateIp(hostname)
  ) {
    throw new UrlValidationError("URL points to a private or blocked host", hostname);
  }

  return parsed;
}

export async function safeFetch(url: string, init: SafeFetchInit = {}): Promise<Response> {
  const {
    followRedirects = false,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    ...fetchInit
  } = init;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal;
  let currentUrl = url;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const parsedCurrentUrl = validateUrl(currentUrl);
    const response = await fetch(currentUrl, {
      ...fetchInit,
      redirect: "manual",
      signal,
    });

    if (!followRedirects || response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    const nextUrl = validateUrl(new URL(location, parsedCurrentUrl).toString());
    if (nextUrl.origin !== parsedCurrentUrl.origin) {
      throw new UrlValidationError("Cross-origin redirects are not supported", nextUrl.hostname);
    }

    currentUrl = nextUrl.toString();
  }

  throw new UrlValidationError(`Too many redirects (>${maxRedirects})`);
}
