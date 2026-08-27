import { fileURLToPath } from "node:url";

import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileRoutes } from "filesystem-routing/vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

export default defineConfig(({ command }) => {
  const cloudflareWorkersAlias: Record<string, string> =
    command === "serve" && process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED !== "1"
      ? {
          "cloudflare:workers": fileURLToPath(
            new URL("./cloudflare-workers.dev.ts", import.meta.url),
          ),
        }
      : {};

  return {
    plugins: [
      solid({
        start: { middleware: "./src/middleware.ts" },
        ssr: true,
        extensions: [".jsx", ".tsx"],
      }),
      fileRoutes({ httpMethods: true }),
      tailwindcss(),
    ],
    server: {
      port: 3001,
    },
    build: {
      rollupOptions: {
        external: ["cloudflare:workers"],
      },
    },
    resolve: {
      tsconfigPaths: true,
      alias: cloudflareWorkersAlias,
    },
  };
});
