export type DeliveryErrorCode = "delivery_not_found" | "delivery_key_conflict";

export class DeliveryDomainError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeliveryDomainError";
  }
}

export class DeliveryKeyConflictError extends DeliveryDomainError {
  constructor() {
    super("delivery_key_conflict", "A delivery record already exists for this key.");
  }
}
