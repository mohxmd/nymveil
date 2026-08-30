import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

const domainSchema = z.object({
  id: z.string(),
  userId: z.string(),
  hostname: z.string(),
  status: z.enum(["pending", "verified", "revoked"]),
  verifiedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const verificationRecordSchema = z.object({
  type: z.literal("TXT"),
  name: z.string(),
  value: z.string(),
});

export const domainListResponseSchema = z.object({
  domains: z.array(domainSchema),
});

export const domainProvisioningResponseSchema = z.object({
  domain: domainSchema,
  verification: verificationRecordSchema,
});

export const domainResponseSchema = z.object({
  domain: domainSchema,
});

export const createDomainInputSchema = z.object({
  hostname: z.string().trim().min(1).max(253),
});

export const domainIdInputSchema = z.object({
  domainId: z.string().trim().min(1).max(128),
});

export const verifyDomainInputSchema = z.object({
  domainId: z.string().trim().min(1).max(128),
  verificationToken: z.string().trim().min(16).max(512),
});
