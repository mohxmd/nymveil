export class DestinationConfigurationError extends Error {
  constructor(message = "Destination configuration is unavailable.") {
    super(message);
    this.name = "DestinationConfigurationError";
  }
}
