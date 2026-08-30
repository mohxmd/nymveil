export type DomainStatus = "pending" | "verified" | "revoked";

export interface Domain {
  id: string;
  userId: string;
  hostname: string;
  status: DomainStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationRecord {
  type: "TXT";
  name: string;
  value: string;
}

export type DomainFormAction = "create-domain" | "rotate-domain-token" | "verify-domain";

export interface DomainFormState {
  action: DomainFormAction;
  domainId?: string;
  error?: string;
  success?: boolean;
  verification?: VerificationRecord;
}
