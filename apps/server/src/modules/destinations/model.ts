import { z } from "zod";

import {
  discordDestinationConfiguration,
  telegramDestinationConfiguration,
} from "./provider-config";

const destination = z.object({
  id: z.string(),
  provider: z.string().min(1),
  label: z.string(),
  enabled: z.boolean(),
  available: z.boolean(),
});

const destinationLabel = z.string().trim().min(1).max(120);
const targetRef = z.string().trim().min(1).max(256);

const destinationConfig = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("dashboard"),
    label: destinationLabel,
    targetRef: z.null().optional(),
    config: z.object({}),
  }),
  z.object({
    provider: z.literal("discord"),
    label: destinationLabel,
    targetRef,
    config: discordDestinationConfiguration,
  }),
  z.object({
    provider: z.literal("telegram"),
    label: destinationLabel,
    targetRef,
    config: telegramDestinationConfiguration,
  }),
]);

export const DestinationModel = {
  createBody: destinationConfig,
  params: z.object({
    destinationId: z.string().trim().min(1).max(128),
  }),
  identityParams: z.object({
    identityId: z.string().trim().min(1).max(128),
  }),
  updateBody: z
    .object({
      enabled: z.boolean().optional(),
      label: destinationLabel.optional(),
      targetRef: targetRef.nullable().optional(),
    })
    .refine(
      (input) =>
        input.enabled !== undefined || input.label !== undefined || input.targetRef !== undefined,
      { message: "At least one destination field is required." },
    ),
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
