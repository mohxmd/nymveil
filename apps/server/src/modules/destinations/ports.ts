export interface DestinationCredentialStore {
  delete(destinationId: string): Promise<void>;
  get(destinationId: string): Promise<unknown | null>;
  save(destinationId: string, configuration: unknown): Promise<void>;
}
