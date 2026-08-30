# Development Guide

This guide covers local development for Nymveil. Use Bun for all repository
commands; the repository pins the expected version in the root `package.json`.

## Prerequisites

- Bun
- Turso CLI for the local libSQL development server
- Git

Cloudflare access is not required for core, database, or web development. It is
required when running the Alchemy deployment stack.

## Setup

From the repository root:

```bash
bun install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Edit `apps/server/.env` and replace the development authentication secret with
a private random value. Local development uses:

```dotenv
DATABASE_URL=http://127.0.0.1:8080
DATABASE_AUTH_TOKEN=
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173
```

`apps/web/.env` should contain:

```dotenv
PUBLIC_SERVER_URL=http://localhost:3000
```

Never commit either `.env` file. The example files contain placeholders only.

## Local database

Start the local Turso/libSQL server in one terminal:

```bash
bun run db:local
```

It listens on port `8080` by default and persists data in
`packages/db/local.db`. In another terminal, apply the checked-in migration
history:

```bash
bun run db:migrate
```

The local database file is ignored by Git. To inspect it, use:

```bash
bun run db:studio
```

Use `bun run db:generate` only after changing a Drizzle schema. Review the
generated SQL and migration metadata before committing it. Prefer migrations
over `db:push` when testing the real production workflow.

## Development commands

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `bun run dev`     | Start the configured workspace development processes |
| `bun run dev:web` | Start the SvelteKit web application directly         |
| `bun run check`   | Run formatting/lint fixes and all type checks        |
| `bun run test`    | Run core, server, database, and notification tests   |
| `bun run build`   | Build the Worker and SvelteKit applications          |
| `bun run format`  | Format repository files                              |
| `bun run lint`    | Run repository lint checks                           |

The Alchemy development stack starts the local Worker and its configured web
development process. If you run the web app directly, do not start a second web
server on the same port.

## Working with changes

Before opening a pull request:

```bash
bun run check
bun run test
bun run build
```

For database changes, also run:

```bash
bunx drizzle-kit check --config drizzle.config.ts
```

Run that command from `packages/db`. Keep schema changes, generated SQL, and
migration metadata in the same focused change.

Do not place real credentials, message content, provider configuration, or
session tokens in tests, fixtures, logs, issues, or pull requests.

## Further reading

- [Deployment and operations](./deployment.md)
- [Architecture boundaries](./architecture.md)
- [Security and privacy baseline](./security-privacy.md)
- [Drizzle migration guide](https://orm.drizzle.team/docs/drizzle-kit-migrate)
