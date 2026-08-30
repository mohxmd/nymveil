export type IdentityErrorCode =
  | "invalid_input"
  | "domain_not_found"
  | "domain_not_usable"
  | "identity_not_found"
  | "identity_address_conflict"
  | "invalid_lifecycle_transition";

export class IdentityDomainError extends Error {
  constructor(
    readonly code: IdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IdentityDomainError";
  }
}

export class IdentityAddressConflictError extends IdentityDomainError {
  constructor() {
    super("identity_address_conflict", "The generated identity address is already in use.");
  }
}
