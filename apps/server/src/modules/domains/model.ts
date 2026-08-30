import { z } from "zod";

const domain = z.object({
  id: z.string(),
  userId: z.string(),
  hostname: z.string(),
  status: z.enum(["pending", "verified", "revoked"]),
  verifiedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

const verificationRecord = z.object({
  type: z.literal("TXT"),
  name: z.string(),
  value: z.string(),
});

export const DomainModel = {
  createBody: z.object({
    hostname: z.string().trim().min(1).max(253),
  }),
  params: z.object({
    domainId: z.string().trim().min(1).max(128),
  }),
  verifyBody: z.object({
    verificationToken: z.string().trim().min(16).max(512),
  }),
  listResponse: z.object({ domains: z.array(domain) }),
  provisioningResponse: z.object({
    domain,
    verification: verificationRecord,
  }),
  response: z.object({ domain }),
} as const;

export type DomainModel = {
  [K in keyof typeof DomainModel]: z.infer<(typeof DomainModel)[K]>;
};
