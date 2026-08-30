# Deployment and Operations

Nymveil deploys its Hono API and SvelteKit dashboard through the Alchemy
Cloudflare stack defined in `packages/infra/alchemy.run.ts`. The deployment
creates or updates the Worker, the static website, and the Worker bindings.

## Production prerequisites

- A Cloudflare account with a domain managed by Cloudflare DNS.
- A Turso/libSQL database and its URL and authentication token.
- A strong Better Auth secret stored outside Git.
- An exact HTTPS origin for the dashboard in `CORS_ORIGIN`.
- A verified custom domain prepared for Email Routing.
- A base64-encoded 32-byte `DESTINATION_ENCRYPTION_KEY` stored in deployment
  secret storage. It encrypts provider credentials before they are persisted.

Alchemy can use the authenticated Cloudflare profile. If the account is not
selected automatically, provide it explicitly:

```bash
CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id> bun run deploy
```

See the [Alchemy Cloudflare authentication guide](https://alchemy.run/guides/cloudflare/)
for account authentication details.

## Environment configuration

Create `apps/server/.env` locally for Alchemy to load. The infrastructure file
reads these values and marks sensitive values as redacted deployment inputs:

| Variable                     | Required             | Description                                   |
| ---------------------------- | -------------------- | --------------------------------------------- |
| `DATABASE_URL`               | Yes                  | Turso/libSQL database URL                     |
| `DATABASE_AUTH_TOKEN`        | Yes for remote Turso | Database authentication token                 |
| `BETTER_AUTH_SECRET`         | Yes                  | Private Better Auth signing/encryption secret |
| `CORS_ORIGIN`                | Yes                  | One exact HTTPS dashboard origin              |
| `DESTINATION_ENCRYPTION_KEY` | Yes                  | Base64-encoded 32-byte AES-GCM key            |

`BETTER_AUTH_URL` is derived from the deployed API Worker URL. The web site's
`PUBLIC_SERVER_URL` is derived from that same Worker output during the Alchemy
build, so it should not be replaced with a secret or hard-coded production URL
in the repository.

The API and identity-creation rate-limit bindings are provisioned by Alchemy.
They are intentionally not configured as ordinary environment strings. Missing
production rate-limit bindings prevent the server from starting.

Never commit `.env` files, provider tokens, webhook URLs, database tokens, or
authentication secrets. Rotate a credential immediately if it is exposed.

## Database release process

Use the checked-in migration history for production. Do not use `db:push` as a
production deployment shortcut.

1. Generate a migration after a schema change:

   ```bash
   bun run db:generate
   ```

2. Review the SQL and generated metadata.
3. Verify the migration history:

   ```bash
   cd packages/db
   bunx drizzle-kit check --config drizzle.config.ts
   cd ../..
   ```

4. Apply the migrations to the intended Turso database:

   ```bash
   bun run db:migrate
   ```

5. Deploy the application:

   ```bash
   bun run deploy
   ```

Drizzle's migration command applies only migrations not already recorded in the
database. [Drizzle migration documentation](https://orm.drizzle.team/docs/drizzle-kit-migrate)

## Cloudflare deployment

Run the preflight checks before deploying:

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
```

Deploy the Alchemy stack:

```bash
bun run deploy
```

The stack currently contains:

- `server`: the Hono API Worker with scheduled cleanup and rate-limit bindings.
- `web`: the SvelteKit Cloudflare site, built with the deployed server URL.

Alchemy creates immutable Worker versions for deployments and manages the
resource relationships defined in `alchemy.run.ts`. Review the deployment
output and record the API and dashboard URLs for the environment.

## Custom-domain email routing

Before enabling inbound mail:

1. Onboard the custom domain in Cloudflare Email Routing.
2. Complete the DNS records and domain verification shown by Cloudflare.
3. Create a routing rule that targets the Nymveil Worker.
4. Send a test message to a known active identity.
5. Confirm that unknown, expired, and torched identities are discarded without
   permanent message storage.

Cloudflare routes mail to Workers through the Worker's `email` handler. The
deployed entrypoint now exports that handler and composes recipient routing,
bounded parsing, and delivery orchestration. Production activation still
requires destination provisioning, provider configuration, Cloudflare routing,
and an end-to-end deployment test. See Cloudflare's [Workers email handler
documentation](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/).

Do not expose a public email webhook as a substitute without adding provider
signature or secret-token verification first.

## Discord and Telegram delivery

The reusable notification package supports Discord and Telegram, and the
application resolves each destination's encrypted provider configuration at
delivery time. When enabled:

- Store the destination encryption key in protected deployment secret storage.
- Provider credentials are encrypted before they are persisted; only safe
  destination references are stored in the public destination metadata row.
- Never return or log provider credentials or decrypted configuration.
- Test each provider independently because one failed destination must not stop
  another selected destination.

Provider-specific credentials are submitted through the authenticated
destination-management API and are not configured as global Worker variables.

## Operational checks

After deployment:

- Open the dashboard and verify authentication and session cookies.
- Confirm the dashboard origin matches `CORS_ORIGIN` exactly.
- Check `/` on the API Worker for a basic health response.
- Verify rate-limit bindings exist and are not failing closed unexpectedly.
- Run a database-backed identity creation and ownership check.
- Check scheduled cleanup execution and failure visibility.
- Send a test inbound message only after the Worker email handler is deployed.
- Confirm logs contain no message bodies, credentials, tokens, or raw MIME data.

## Troubleshooting

| Symptom                                       | Checks                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| SvelteKit says `PUBLIC_SERVER_URL` is missing | Set it in `apps/web/.env` for local work; Alchemy injects it during deployment.                                        |
| Database connection fails                     | Check `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, and whether the Turso dev server is running locally.                      |
| Authentication does not persist               | Check `CORS_ORIGIN`, the dashboard origin, HTTPS in production, and browser cookie policy.                             |
| API returns `503` about request protection    | Verify both Alchemy rate-limit bindings were provisioned.                                                              |
| Migration fails                               | Run `drizzle-kit check`, inspect the applied migration history, and do not edit an already-applied migration.          |
| Mail does not arrive                          | Verify Cloudflare Email Routing DNS, the Worker target, an exported `email` handler, and the recipient identity state. |
| Provider delivery fails                       | Check protected credentials, destination selection, provider limits, and the safe delivery metadata/error category.    |

## Destructive operations

`bun run destroy` removes the Alchemy-managed stack. Use it only for an
explicitly identified development or preview environment after confirming the
target account and state. Never use it as a production troubleshooting step.
