# Nymveil Architecture Boundaries

Nymveil uses ports and adapters so its product rules remain independent from deployment providers and delivery services.

## Dependency direction

```text
apps/web ───────────────┐
                        v
apps/server ───────> @nymveil/core <────── future CLI / SDK
     │                    │
     ├── @nymveil/auth    │ ports
     ├── @nymveil/db ─────┘
     ├── @nymveil/notifications
     └── Cloudflare / Hono adapters
```

Dependencies point inward toward the domain. The core package must never import an outer adapter or infrastructure package.

## Database naming conventions

Database object names use lowercase `snake_case` and include the owning table:

```text
idx_<table>_<columns>
uidx_<table>_<columns>
fk_<table>_<column>_<referenced_table>
chk_<table>_<rule>
pk_<table>
```

Examples include `idx_identity_status_expires_at`, `uidx_identity_address`, and `pk_identity_destination`. Column keys remain idiomatic camelCase in TypeScript and are mapped to snake_case database columns by the Drizzle casing configuration. Index and constraint names remain explicit so they are stable and searchable across migrations.

## `@nymveil/core`

The core owns behavior that describes Nymveil, regardless of where it runs:

- Identity lifecycle rules.
- Domain and address validation.
- Expiration and torch behavior.
- Ownership and authorization decisions.
- Destination selection decisions.
- Delivery and retention contracts.
- Use cases that coordinate the rules above through injected ports.

The core must not know about HTTP requests, Cloudflare email events, SQL syntax, Drizzle schemas, provider SDKs, or framework state.

## Persistence port

The core will depend on a domain-oriented repository interface. The database package will implement it.

The final methods and data shapes will be defined with the identity model in the next domain ticket. The boundary should follow this shape:

```ts
interface IdentityRepository {
  findByAddress(address: string): Promise<Identity | null>;
  findById(ownerId: string, identityId: string): Promise<Identity | null>;
  save(identity: Identity): Promise<void>;
  update(identity: Identity): Promise<void>;
}
```

The interface returns domain data, not Drizzle rows, SQL results, or provider-specific values. Transactions and query implementation details stay inside `@nymveil/db`.

## Delivery port

The core will request delivery through an infrastructure-neutral port. The notifications package and application adapters will implement or compose it.

```ts
interface DeliveryPort {
  deliver(input: DeliveryRequest): Promise<DeliveryResult>;
}
```

`DeliveryRequest` and `DeliveryResult` will be defined as domain contracts. They must contain only the information needed to make a delivery decision and record its outcome. Provider SDK response objects must not cross the boundary.

One failed destination must not prevent independent eligible destinations from being attempted. Retry, timeout, provider authentication, and transport behavior belong outside the core.

## Application and infrastructure adapters

### `apps/server`

Owns Hono routes, authentication integration, Cloudflare Worker entrypoints, inbound email event conversion, and use-case composition.

It converts external requests into core inputs and converts core results into HTTP or runtime responses.

### `@nymveil/db`

Owns Drizzle schemas, Turso/libSQL queries, migrations, transactions, and repository implementations for core ports.

### `@nymveil/notifications`

Owns reusable provider transport and delivery behavior for Discord, Telegram, Slack, webhooks, and future providers. It does not own Nymveil identity or routing rules.

### `@nymveil/auth`

Owns Better Auth configuration and authentication integration. Ownership checks remain part of application use-case authorization and must not be inferred from client input.

### `apps/web`

Owns SvelteKit pages, forms, client state, and presentation. It calls the authenticated API and does not implement domain decisions locally.

## Boundary rules

1. Business rules belong in `@nymveil/core`.
2. Infrastructure implementations depend on core contracts; core never depends on implementations.
3. External payloads are validated and normalized at adapter boundaries.
4. Provider SDK types do not appear in core exports.
5. Database row types do not appear in core exports.
6. Core use cases receive dependencies explicitly instead of importing global clients.
7. The web application must not be treated as an authorization boundary.
