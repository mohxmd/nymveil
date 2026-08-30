import type { DestinationRecord, IdentityDestinationRecord } from "./types";

export interface DestinationRepository {
  findById(id: string): Promise<DestinationRecord | null>;
  listByUserId(userId: string): Promise<DestinationRecord[]>;
  create(destination: DestinationRecord): Promise<DestinationRecord>;
  update(destination: DestinationRecord): Promise<DestinationRecord>;
  delete(userId: string, id: string): Promise<void>;
}

export interface IdentityDestinationRepository {
  listByIdentityId(identityId: string): Promise<IdentityDestinationRecord[]>;
  add(route: IdentityDestinationRecord): Promise<IdentityDestinationRecord>;
  remove(identityId: string, destinationId: string): Promise<void>;
}
