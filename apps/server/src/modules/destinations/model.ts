import { z } from "zod";

const destination = z.object({
  id: z.string(),
  provider: z.string().min(1),
  label: z.string(),
  enabled: z.boolean(),
  available: z.boolean(),
});

export const DestinationModel = {
  params: z.object({
    destinationId: z.string().trim().min(1).max(128),
  }),
  identityParams: z.object({
    identityId: z.string().trim().min(1).max(128),
  }),
  updateBody: z.object({
    enabled: z.boolean(),
  }),
  listResponse: z.object({
    destinations: z.array(destination),
  }),
  identityListResponse: z.object({
    destinations: z.array(destination.extend({ selected: z.boolean() })),
  }),
  routeResponse: z.object({
    ok: z.literal(true),
  }),
} as const;

export type DestinationModel = {
  [K in keyof typeof DestinationModel]: z.infer<(typeof DestinationModel)[K]>;
};
