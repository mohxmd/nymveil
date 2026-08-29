import { IdentityDomainError } from "./errors";
import type { IdentityRecord } from "./types";

export const MAX_LABEL_LENGTH = 120;
export const MAX_LOCAL_PART_LENGTH = 64;
export const MAX_IDENTITY_ADDRESS_LENGTH = 254;

const localPartPattern = /^[a-z0-9](?:[a-z0-9.!#$%&'*+\-/=?^_`{|}~]*[a-z0-9])?$/;
const hostnameLabelPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeRequiredId(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new IdentityDomainError("invalid_input", `${field} is required.`);
  }

  return normalized;
}

export function normalizeLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized || normalized.length > MAX_LABEL_LENGTH) {
    throw new IdentityDomainError(
      "invalid_input",
      `Label must contain between 1 and ${MAX_LABEL_LENGTH} characters.`,
    );
  }

  return normalized;
}

export function normalizeHostname(value: string): string {
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");
  const labels = hostname.split(".");

  if (
    hostname.length < 3 ||
    hostname.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => label.length > 63 || !hostnameLabelPattern.test(label))
  ) {
    throw new IdentityDomainError("invalid_input", "The domain hostname is invalid.");
  }

  return hostname;
}

export function normalizeLocalPart(value: string): string {
  const localPart = value.trim().toLowerCase();

  if (
    localPart.length === 0 ||
    localPart.length > MAX_LOCAL_PART_LENGTH ||
    !localPartPattern.test(localPart)
  ) {
    throw new IdentityDomainError("invalid_input", "The identity local part is invalid.");
  }

  return localPart;
}

export function normalizeAddress(value: string): string {
  const address = value.trim().toLowerCase();
  const separator = address.lastIndexOf("@");
  const localPart = separator === -1 ? "" : address.slice(0, separator);
  const hostname = separator === -1 ? "" : address.slice(separator + 1);
  const normalized = `${normalizeLocalPart(localPart)}@${normalizeHostname(hostname)}`;

  if (normalized.length > MAX_IDENTITY_ADDRESS_LENGTH) {
    throw new IdentityDomainError("invalid_input", "The identity address is too long.");
  }

  return normalized;
}

export function normalizeExpiration(expiresAt: Date | null | undefined, now: Date): Date | null {
  if (expiresAt == null) {
    return null;
  }

  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    throw new IdentityDomainError("invalid_input", "Expiration must be a future date.");
  }

  return new Date(expiresAt);
}

export function hasExpired(identity: IdentityRecord, now: Date): boolean {
  return identity.expiresAt !== null && identity.expiresAt <= now;
}

export function isRoutable(identity: IdentityRecord, now: Date): boolean {
  return identity.status === "active" && !hasExpired(identity, now);
}
