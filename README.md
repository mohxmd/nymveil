# Nymveil

> Your identity stays behind the veil. 🕶️

Nymveil is an open-source email identity and routing system. Create isolated email addresses on your custom domain, control where messages are delivered, set how long identities live, and torch them when they are no longer needed.

## Why Nymveil?

Every service gets its own email identity:

```text
github-k7x2@yourdomain.com
netflix-p9m4@yourdomain.com
randomsite-a2q8@yourdomain.com
```

If an identity starts receiving unwanted mail, disable that identity instead of exposing or replacing your primary inbox address.

## Current direction

Nymveil is in early development. The project is being built around an authenticated web dashboard, a framework-independent domain core, Cloudflare inbound email processing, and pluggable delivery providers.

## Planned capabilities

- Custom-domain email identities
- Labels and expiration policies
- Permanent torch/revoke actions
- Cloudflare Email Routing integration
- Discord and Telegram delivery
- Web dashboard and delivery metadata
- Minimal message retention by default
- Extensible notification providers

## Planned architecture

The repository is being organized so product rules remain independent from infrastructure providers:

| Package or app           | Responsibility                                        |
| ------------------------ | ----------------------------------------------------- |
| `@nymveil/core`          | Framework-independent domain rules and use cases      |
| `@nymveil/db`            | Drizzle and Turso schema, migrations, and persistence |
| `@nymveil/notifications` | Reusable notification providers and delivery behavior |
| `@nymveil/auth`          | Authentication integration                            |
| `apps/server`            | Hono API and Cloudflare Worker adapters               |
| `apps/web`               | Authenticated web dashboard                           |
| `packages/infra`         | Cloudflare and deployment infrastructure              |

More product and architecture context is available in [`docs/nymveil.md`](./docs/nymveil.md).

## Technology

- TypeScript
- Bun
- Hono
- Cloudflare Workers and Email Routing
- Turso / libSQL
- Drizzle ORM
- Better Auth
- SvelteKit and Vite

## Development

Requirements:

- [Bun](https://bun.sh/)
- A local environment configured for the relevant applications

Install dependencies:

```bash
bun install
```

Run the project checks:

```bash
bun run check
```

See the [development guide](./docs/development.md) for local database setup
and the [deployment guide](./docs/deployment.md) for Cloudflare operations.

Start the development applications:

```bash
bun run dev
```

## Contributing

Nymveil is being developed in small, reviewable steps. Before opening a pull request:

1. Check the relevant GitHub issue.
2. Keep changes focused on that issue.
3. Add or update tests for behavior changes.
4. Run formatting, linting, and type checks locally.
5. Explain important design decisions in the pull request.

Please avoid including credentials, real email content, or private provider configuration in issues, logs, tests, or pull requests.

## Project status

The project is not production-ready yet. APIs, database schemas, and deployment workflows may change while the first stable release is being built.
