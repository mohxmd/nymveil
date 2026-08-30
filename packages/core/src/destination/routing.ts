import { isRoutable } from "../identity/rules";
import type { IdentityRecord } from "../identity/types";
import type { DestinationRecord, IdentityDestinationRecord } from "./types";

/**
 * Returns all explicitly selected destinations that can receive an identity.
 * Selection order is preserved for stable delivery orchestration.
 */
export function getEligibleDestinations(
  identity: IdentityRecord,
  routes: IdentityDestinationRecord[],
  destinations: DestinationRecord[],
  now: Date,
): DestinationRecord[] {
  if (!isRoutable(identity, now)) {
    return [];
  }

  const destinationsById = new Map(
    destinations.map((destination) => [destination.id, destination]),
  );
  const selected = new Set<string>();
  const eligible: DestinationRecord[] = [];

  for (const route of routes) {
    if (route.identityId !== identity.id || selected.has(route.destinationId)) {
      continue;
    }

    const destination = destinationsById.get(route.destinationId);

    if (!destination || destination.userId !== identity.userId || !destination.enabled) {
      continue;
    }

    selected.add(destination.id);
    eligible.push(destination);
  }

  return eligible;
}
