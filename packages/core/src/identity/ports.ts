import type { IdentityRecord } from "./types";

export interface DomainRepository {
  findById(id: string): Promise<import("./types").DomainRecord | null>;
}

export interface IdentityRepository {
  findById(id: string): Promise<IdentityRecord | null>;
  findByAddress(address: string): Promise<IdentityRecord | null>;
  create(identity: IdentityRecord): Promise<IdentityRecord>;
  update(identity: IdentityRecord): Promise<IdentityRecord>;
}

export interface IdGenerator {
  generate(): string;
}

export interface LocalPartGenerator {
  generate(): string;
}

export interface Clock {
  now(): Date;
}
