export type DomainErrorCode =
  | "invalid_input"
  | "domain_not_found"
  | "domain_hostname_conflict"
  | "domain_verification_failed"
  | "domain_verification_unavailable"
  | "invalid_lifecycle_transition";

export class DomainDomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainDomainError";
  }
}

export class DomainHostnameConflictError extends DomainDomainError {
  constructor() {
    super("domain_hostname_conflict", "The domain hostname is already registered.");
  }
}
