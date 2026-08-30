import { z } from "zod";

const domain = z.object({
  id: z.string(),
  userId: z.string(),
  hostname: z.string(),
  status: z.enum(["pending", "verified", "revoked"]),
});

export const DomainModel = {
  listResponse: z.object({ domains: z.array(domain) }),
} as const;

export type DomainModel = {
  [K in keyof typeof DomainModel]: z.infer<(typeof DomainModel)[K]>;
};
