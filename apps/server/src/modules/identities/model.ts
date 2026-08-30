import { z } from "zod";

const identity = z.object({
  id: z.string(),
  userId: z.string(),
  domainId: z.string(),
  localPart: z.string(),
  address: z.string(),
  label: z.string(),
  status: z.enum(["active", "expired", "torched"]),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  torchedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

const identityId = z.object({
  id: z.string().trim().min(1).max(128),
});

const expiresAt = z.iso.datetime({ offset: true });

export const IdentityModel = {
  params: identityId,
  createBody: z.object({
    domainId: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(120),
    expiresAt: expiresAt.nullable().optional(),
  }),
  updateBody: z
    .object({
      label: z.string().trim().min(1).max(120).optional(),
      expiresAt: expiresAt.nullable().optional(),
    })
    .refine((input) => input.label !== undefined || input.expiresAt !== undefined, {
      message: "At least one identity field is required.",
    }),
  response: z.object({ identity }),
  listResponse: z.object({ identities: z.array(identity) }),
} as const;

export type IdentityModel = {
  [K in keyof typeof IdentityModel]: z.infer<(typeof IdentityModel)[K]>;
};
