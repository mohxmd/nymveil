import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

const identitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  domainId: z.string(),
  localPart: z.string(),
  address: z.string(),
  label: z.string(),
  status: z.enum(["active", "expired", "torched"]),
  expiresAt: timestamp.nullable(),
  torchedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const domainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  hostname: z.string(),
  status: z.enum(["pending", "verified", "revoked"]),
});

export const identityListResponseSchema = z.object({
  identities: z.array(identitySchema),
});

export const identityResponseSchema = z.object({
  identity: identitySchema,
});

export const domainListResponseSchema = z.object({
  domains: z.array(domainSchema),
});

export const createIdentityInputSchema = z.object({
  domainId: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(120),
});

export const updateIdentityInputSchema = z.object({
  id: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(120),
});

export const identityIdInputSchema = z.object({
  id: z.string().trim().min(1).max(128),
});
