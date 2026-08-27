import { z } from "zod";

const envSchema = z.object({
  VITE_SERVER_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url(),
  ),
});

export const env = envSchema.parse({
  VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL,
});
