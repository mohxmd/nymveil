export type IdentityStatus = "active" | "expired" | "torched";

export interface Identity {
  id: string;
  userId: string;
  domainId: string;
  localPart: string;
  address: string;
  label: string;
  status: IdentityStatus;
  expiresAt: string | null;
  torchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  userId: string;
  hostname: string;
  status: "pending" | "verified" | "revoked";
}

export interface Destination {
  id: string;
  provider: string;
  label: string;
  enabled: boolean;
  available: boolean;
}

export interface IdentityDestinationOption extends Destination {
  selected: boolean;
}

export type IdentityFormAction =
  | "create"
  | "update"
  | "torch"
  | "toggle-destination"
  | "toggle-route";

export interface IdentityFormState {
  action: IdentityFormAction;
  identityId?: string;
  destinationId?: string;
  error?: string;
  success?: boolean;
}
