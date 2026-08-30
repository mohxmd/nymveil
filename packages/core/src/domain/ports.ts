export type DomainVerificationCheck = "verified" | "not_found" | "unavailable";

export interface DomainChallengeHasher {
  hash(value: string): Promise<string>;
  verify(value: string, expectedHash: string): Promise<boolean>;
}

export interface DomainTokenGenerator {
  generate(): string;
}

export interface DomainVerifier {
  verify(hostname: string, token: string): Promise<DomainVerificationCheck>;
}
