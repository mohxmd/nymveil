import { describe, expect, test } from "bun:test";

import { normalizeAddress, normalizeHostname, normalizeLocalPart } from "../src";

describe("identity input rules", () => {
  test("normalizes valid hostnames and addresses", () => {
    expect(normalizeHostname(" Example.COM. ")).toBe("example.com");
    expect(normalizeLocalPart(" GitHub-K7X2 ")).toBe("github-k7x2");
    expect(normalizeAddress("GitHub-K7X2@Example.COM.")).toBe("github-k7x2@example.com");
  });

  test("rejects invalid hostnames and local parts", () => {
    expect(() => normalizeHostname("localhost")).toThrow();
    expect(() => normalizeHostname("-example.com")).toThrow();
    expect(() => normalizeLocalPart(".github")).toThrow();
    expect(() => normalizeLocalPart("github.")).toThrow();
  });

  test("rejects malformed or oversized addresses", () => {
    expect(() => normalizeAddress("missing-at")).toThrow();
    expect(() => normalizeAddress("github@example")).toThrow();
    expect(() => normalizeAddress(`${"a".repeat(64)}@example.com`)).not.toThrow();
    expect(() => normalizeAddress(`${"a".repeat(65)}@example.com`)).toThrow();
  });
});
