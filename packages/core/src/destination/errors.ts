export type DestinationErrorCode =
  | "invalid_input"
  | "destination_not_found"
  | "identity_not_found"
  | "invalid_lifecycle_transition";

export class DestinationDomainError extends Error {
  constructor(
    readonly code: DestinationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DestinationDomainError";
  }
}
