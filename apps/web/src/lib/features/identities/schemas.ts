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

const destinationSchema = z.object({
  id: z.string(),
  provider: z.string().min(1),
  label: z.string(),
  enabled: z.boolean(),
  available: z.boolean(),
});

export const identityListResponseSchema = z.object({
  identities: z.array(identitySchema),
});

export const identityResponseSchema = z.object({
  identity: identitySchema,
});

export const destinationListResponseSchema = z.object({
  destinations: z.array(destinationSchema),
});

export const identityDestinationListResponseSchema = z.object({
  destinations: z.array(destinationSchema.extend({ selected: z.boolean() })),
});

export const destinationResponseSchema = z.object({
  destination: destinationSchema,
});

export const routeResponseSchema = z.object({
  ok: z.literal(true),
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

export const destinationToggleInputSchema = z.object({
  id: z.string().trim().min(1).max(128),
  enabled: z.boolean(),
});

export const identityRouteInputSchema = z.object({
  identityId: z.string().trim().min(1).max(128),
  destinationId: z.string().trim().min(1).max(128),
  selected: z.boolean(),
});
