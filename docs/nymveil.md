# Nymveil

Nymveil is an open-source, serverless email identity and routing system. It lets people create isolated email addresses on a custom domain without exposing their primary inbox.

The precise MVP behavior and boundaries are defined in the [MVP product contract](./product-contract.md).
Security and privacy requirements are defined in the [security and privacy baseline](./security-privacy.md).
The persistent identity model is defined in the [domain model](./domain-model.md).

## Product definition

Nymveil creates one email identity for each service, project, or situation:

```text
github-k7x2@yourdomain.com
netflix-p9m4@yourdomain.com
randomsite-a2q8@yourdomain.com
```

Each identity can have a label, an expiration time, one or more delivery destinations, and a permanent torch/revoke action.

Nymveil is an identity layer between a person and the services they use. The user controls which address is exposed, where messages are delivered, how long the identity exists, and when it disappears.

## Primary user journey

```text
Sign up or sign in
  -> configure an available custom domain
  -> create an email identity
  -> add a label and expiration policy
  -> choose delivery destinations
  -> use the address with an external service
  -> receive the message through approved destinations
  -> manage, extend, or torch the identity
```

The web dashboard is the primary interface. An API and optional chat integrations can provide additional ways to manage identities later.

## Authentication and ownership

Nymveil requires application authentication because identities, domains, routing rules, and delivery metadata belong to users.

- Better Auth manages application accounts and sessions.
- Every identity belongs to an authenticated application user.
- Every API operation checks ownership before reading or changing data.
- Discord and Telegram accounts can be linked to an application user later.
- Provider credentials remain deployment secrets or encrypted configuration, never ordinary plaintext user data.

## Email processing

Cloudflare Email Routing forwards inbound mail to a Cloudflare Worker. The Worker:

1. Normalizes the recipient address.
2. Resolves the identity from the database.
3. Rejects unknown, expired, or torched identities.
4. Parses the message with strict size and attachment limits.
5. Delivers approved content or metadata to configured destinations.
6. Records delivery metadata and provider results.
7. Avoids permanently retaining full email content by default.

The core processing rules must not depend on Cloudflare, Turso, Hono, Discord, or Telegram.

## Architecture boundaries

### `@nymveil/core`

Framework-independent domain rules and use cases:

- Identity lifecycle
- Domain and address validation
- Expiration and torch behavior
- Routing decisions
- Delivery event contracts
- Retention policies

### `@nymveil/db`

Drizzle/Turso persistence:

- Database schema
- Migrations
- Repository implementations
- Query and transaction boundaries

### `@nymveil/notifications`

Reusable delivery infrastructure:

- Discord provider
- Telegram provider
- Slack provider
- Email provider
- Webhook provider
- Custom provider registry
- Retry, timeout, and safe HTTP behavior

It does not contain Nymveil-specific business events or database logic.

### `apps/server`

Application adapters:

- Hono HTTP API
- Better Auth integration
- Cloudflare Worker entrypoints
- Inbound email adapter
- Scheduled cleanup and delivery orchestration

### `apps/web`

Authenticated dashboard:

- Identity management
- Domain and destination settings
- Delivery metadata
- Expiration and torch controls

### `packages/infra`

Cloudflare and deployment definitions, environment bindings, and operational configuration.

## Core data concepts

### Domains

A domain is an approved email namespace available for identities. It has an ownership relationship, verification state, and lifecycle metadata.

### Email identities

An identity contains a generated local part, domain reference, owner, label, status, expiration policy, and timestamps.

Expected lifecycle states:

```text
active -> expired
active -> torched
expired -> torched or archived
```

### Destinations

A destination describes where an identity's messages may be delivered. Destinations are explicit and independently enableable. Configured providers are not automatically broadcast unless the user or application policy selects them.

### Delivery metadata

Delivery records contain safe operational data such as provider, status, timestamps, and redacted errors. Full message content is not part of the default permanent record.

## Privacy and security principles

- Reject invalid, expired, and torched identities before processing whenever possible.
- Do not expose whether another user's identity exists.
- Never log message bodies, credentials, or sensitive provider configuration.
- Apply message, HTML, and attachment size limits.
- Treat inbound email content as untrusted input.
- Verify webhook signatures or secret tokens.
- Use rate limits for identity creation and sensitive actions.
- Keep application ownership checks in the server and core use cases.
- Make retention behavior explicit and testable.

## First release scope

- Application authentication
- Custom-domain support
- Domain and identity lifecycle management
- Labels and expiration
- Torch/revoke
- Authenticated identity API
- Web dashboard
- Cloudflare inbound email processing
- Discord and Telegram delivery
- Delivery metadata
- Minimal message retention
- Scheduled expiration and cleanup

## Later scope

- Additional delivery adapters
- Optional full-content retention with user-controlled expiry
- Chat-based identity management
- CLI and SDK
- Public hosted service
- Multiple domain providers
- Advanced routing rules
- Queue-backed delivery

## Guiding principle

Nymveil should remain small at its boundaries and strong in its core: domain rules stay portable, infrastructure stays replaceable, and every user-facing action remains explicit, private, and auditable.
