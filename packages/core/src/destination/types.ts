export const builtInDestinationProviders = ["dashboard", "discord", "telegram"] as const;

export type BuiltInDestinationProvider = (typeof builtInDestinationProviders)[number];

/** Provider keys remain open for future adapters while built-in keys stay discoverable. */
export type DestinationProvider = BuiltInDestinationProvider | (string & {});

export interface DestinationRecord {
  id: string;
  userId: string;
  provider: DestinationProvider;
  label: string;
  /** Provider-specific account or target id; never a provider secret. */
  targetRef: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityDestinationRecord {
  identityId: string;
  destinationId: string;
  createdAt: Date;
}
