import { z } from "zod";

const webEnvSchema = z.object({
  PUBLIC_SERVER_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url()),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(input: unknown): WebEnv {
  return webEnvSchema.parse(input);
}
