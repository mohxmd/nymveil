# Nymveil First-Release Checklist

This checklist is the final production gate for the first Nymveil release. It
must be completed against the intended Cloudflare account and Turso database;
passing local checks alone is not production approval.

## Scope approval

- [ ] Review [`product-contract.md`](./product-contract.md) and approve the
      first-release scope and known limitations.
- [ ] Confirm that full message content is not required for the first release.
- [ ] Confirm the delivery metadata retention period and security-event policy.
- [ ] Confirm a tested rollback owner and an incident contact.

## Local quality gate

Run these commands from the repository root on the release commit:

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
```

Verify the database migration history separately:

```bash
cd packages/db
bun x drizzle-kit check --config drizzle.config.ts
cd ../..
```

The release commit must have a clean working tree after these checks. Do not
include `.env` files, generated output, provider credentials, database tokens,
or real email content.

## Production configuration

Before deployment, prepare these values in protected deployment configuration:

- `DATABASE_URL` for the intended Turso database.
- `DATABASE_AUTH_TOKEN` for the intended Turso database.
- `BETTER_AUTH_SECRET` generated specifically for the environment.
- Exact HTTPS `CORS_ORIGIN` for the deployed dashboard.
- Base64-encoded 32-byte `DESTINATION_ENCRYPTION_KEY`.

Confirm that the Alchemy stack provisions both rate-limit bindings and that the
Worker receives the expected variables and secrets. Never paste secret values
into GitHub issues, pull requests, terminal transcripts, or deployment notes.

## Database release

1. Confirm the target database URL and token out of band.
2. Review every unapplied migration and its generated metadata.
3. Apply migrations with the checked-in history:

   ```bash
   bun run db:migrate
   ```

4. Verify the migration command completed successfully and did not modify an
   already-applied migration.
5. Record the migration commit and deployment timestamp in the private release
   record.

Do not use `db:push` for production and do not edit an already-applied SQL
migration. If a migration is unsafe, stop the release and create a new forward
migration after review.

## Cloudflare and email routing

- [ ] Deploy the reviewed commit with `bun run deploy`.
- [ ] Confirm the API Worker URL and dashboard URL.
- [ ] Confirm the dashboard URL is the configured `CORS_ORIGIN`.
- [ ] Confirm both rate-limit bindings are present.
- [ ] Enable Cloudflare Email Routing for the intended custom domain.
- [ ] Complete Cloudflare's DNS and routing configuration.
- [ ] Configure the Worker as the email destination according to the deployment
      guide.
- [ ] Confirm the Worker's `email` handler is present in the deployed version.

Domain ownership verification in Nymveil and Cloudflare Email Routing setup are
separate operations. Complete both before sending production mail. See
[`deployment.md`](./deployment.md#custom-domain-email-routing).

## Authenticated smoke test

Run this with a disposable test account and a domain intended for testing:

1. Create an account and sign in through the dashboard.
2. Add a custom domain and confirm it starts in `pending` state.
3. Publish the Nymveil TXT challenge and verify the domain.
4. Confirm the verification token is not returned by the domain list endpoint.
5. Configure one test destination through the authenticated management flow.
6. Create an identity on the verified domain.
7. Select exactly one destination for the identity.
8. Send a test email and confirm one safe delivery attempt is recorded.
9. Confirm the destination receives only the intended metadata-safe notification.
10. Confirm sender, subject, body, attachment bytes, credentials, and raw
    provider responses are absent from logs and durable records.

## Routing and failure smoke test

- [ ] Send to an unknown recipient and confirm it is discarded.
- [ ] Send to an expired identity and confirm it is discarded.
- [ ] Send to a torched identity and confirm it is discarded.
- [ ] Temporarily disable one selected destination and confirm another selected
      destination still receives its notification.
- [ ] Exercise a transient provider failure and confirm bounded retries occur.
- [ ] Exercise a permanent provider/configuration failure and confirm the
      attempt becomes `failed` without automatic cross-event resend.
- [ ] Replay the same inbound event and confirm it does not create a duplicate
      successful delivery.

## Rollback and incident readiness

- Application rollback is a forward deployment of the last known-good commit:
  check out or build that commit in a clean workspace and run `bun run deploy`.
- Do not blindly roll back database migrations. Keep migrations backward
  compatible with the previous application version, or prepare a reviewed
  forward migration before reverting application code.
- If credentials may have been exposed, disable or rotate the affected provider
  credential, destination encryption key, database token, or auth secret before
  restoring traffic.
- If message content may have been logged or persisted, stop delivery, preserve
  only the minimum evidence required for investigation, and follow the private
  incident process.
- Record the failed release commit, observed symptoms, affected resources, and
  recovery commit privately.

## Sign-off

- [ ] Local quality gate passed on the release commit.
- [ ] Intended database migration completed.
- [ ] Cloudflare deployment and bindings verified.
- [ ] Domain onboarding and inbound email smoke tests passed.
- [ ] Destination delivery, idempotency, and failure-path tests passed.
- [ ] Security and privacy review approved.
- [ ] Rollback owner approved the release.
