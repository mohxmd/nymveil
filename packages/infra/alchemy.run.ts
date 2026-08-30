import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

export const server = Cloudflare.Worker("server", {
  main: "../../apps/server/src/index.ts",
  crons: ["0 * * * *"],
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DATABASE_URL: Config.redacted("DATABASE_URL"),
    CORS_ORIGIN: Config.string("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    DATABASE_AUTH_TOKEN: Config.redacted("DATABASE_AUTH_TOKEN"),
    DESTINATION_ENCRYPTION_KEY: Config.redacted("DESTINATION_ENCRYPTION_KEY"),
    API_RATE_LIMITER: Cloudflare.RateLimit("API_RATE_LIMITER", {
      namespaceId: 1001,
      simple: {
        limit: 120,
        period: 60,
      },
    }),
    IDENTITY_CREATION_RATE_LIMITER: Cloudflare.RateLimit("IDENTITY_CREATION_RATE_LIMITER", {
      namespaceId: 1002,
      simple: {
        limit: 10,
        period: 60,
      },
    }),
  },
  dev: {
    port: 3000,
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "nymveil",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const serverWorker = yield* server;
    // _worker.js is a shim importing outside its directory, so it must be bundled
    const webWorker = yield* Cloudflare.Website.StaticSite("web", {
      cwd: "../../apps/web",
      command: "bun run build",
      // Rebuild shared workspace dependencies until Alchemy has a workspace-aware default memo.
      memo: false,
      outdir: ".svelte-kit/cloudflare",
      main: "../../apps/web/.svelte-kit/cloudflare/_worker.js",
      compatibility: {
        flags: ["nodejs_compat"],
      },
      env: {
        PUBLIC_SERVER_URL: serverWorker.url.as<string>(),
      },
      dev: {
        command: "bun run dev:bare",
        url: "http://localhost:5173",
      },
    });

    return {
      web: webWorker.url,
      server: serverWorker.url,
    };
  }),
);
