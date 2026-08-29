import { describe, expect, test } from "bun:test";

import { getEligibleDestinations } from "../src";
import type { DestinationRecord, IdentityDestinationRecord, IdentityRecord } from "../src";

const now = new Date("2026-08-30T12:00:00.000Z");

const identity: IdentityRecord = {
  id: "identity-1",
  userId: "user-1",
  domainId: "domain-1",
  localPart: "github-k7x2",
  address: "github-k7x2@example.com",
  label: "GitHub",
  status: "active",
  expiresAt: null,
  torchedAt: null,
  createdAt: now,
  updatedAt: now,
};

function destination(
  id: string,
  provider: DestinationRecord["provider"],
  overrides: Partial<DestinationRecord> = {},
): DestinationRecord {
  return {
    id,
    userId: "user-1",
    provider,
    label: provider,
    targetRef: provider === "dashboard" ? null : `${provider}-target-1`,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function route(destinationId: string): IdentityDestinationRecord {
  return { identityId: identity.id, destinationId, createdAt: now };
}

describe("getEligibleDestinations", () => {
  test("returns explicitly selected enabled destinations in selection order", () => {
    const dashboard = destination("destination-1", "dashboard");
    const discord = destination("destination-2", "discord");

    expect(
      getEligibleDestinations(
        identity,
        [route(discord.id), route(dashboard.id)],
        [dashboard, discord],
        now,
      ),
    ).toEqual([discord, dashboard]);
  });

  test("excludes disabled and foreign destinations", () => {
    const disabled = destination("destination-1", "discord", { enabled: false });
    const foreign = destination("destination-2", "telegram", { userId: "user-2" });

    expect(
      getEligibleDestinations(
        identity,
        [route(disabled.id), route(foreign.id)],
        [disabled, foreign],
        now,
      ),
    ).toEqual([]);
  });

  test("returns no destinations for expired or torched identities", () => {
    const discord = destination("destination-1", "discord");
    const selected = [route(discord.id)];

    expect(
      getEligibleDestinations({ ...identity, status: "expired" }, selected, [discord], now),
    ).toEqual([]);
    expect(
      getEligibleDestinations({ ...identity, status: "torched" }, selected, [discord], now),
    ).toEqual([]);
  });
});
