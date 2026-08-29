export const identityStatuses = ["active", "expired", "torched"] as const;

export type IdentityStatus = (typeof identityStatuses)[number];

export interface DomainRecord {
  id: string;
  userId: string;
  hostname: string;
  status: "pending" | "verified" | "revoked";
}

export interface IdentityRecord {
  id: string;
  userId: string;
  domainId: string;
  localPart: string;
  address: string;
  label: string;
  status: IdentityStatus;
  expiresAt: Date | null;
  torchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIdentityInput {
  userId: string;
  domainId: string;
  label: string;
  expiresAt?: Date | null;
}

export interface UpdateIdentityInput {
  label?: string;
  expiresAt?: Date | null;
}
