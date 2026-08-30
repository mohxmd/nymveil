# Nymveil Domain and Identity Model

This document defines the persistent domain model for the MVP.

## Design principles

- Domain rules are represented independently from Drizzle types.
- Database constraints enforce ownership and uniqueness invariants.
- Mutable lifecycle state is explicit and auditable.
- User-facing values are normalized at the application boundary before persistence.
- Provider credentials are not ordinary plaintext fields in domain tables.
- Relationships that may become many-to-many use explicit junction tables.

## Users

Users are owned by Better Auth's `user` table. Nymveil tables reference the stable user id with a foreign key and cascade behavior appropriate to account deletion.

The Nymveil domain must never duplicate authentication credentials or session state.

## Domains

A domain is a custom email namespace that a user is allowed to use for identities.

### Fields

| Field                   | Meaning                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `id`                    | Opaque immutable domain id                                                     |
| `userId`                | Owning Better Auth user id                                                     |
| `hostname`              | Normalized lowercase domain name                                               |
| `status`                | Domain verification lifecycle state                                            |
| `verificationTokenHash` | One-way hash of the active ownership challenge, never exposed in API responses |
| `verifiedAt`            | Time verification completed, nullable                                          |
| `createdAt`             | Creation time                                                                  |
| `updatedAt`             | Last mutation time                                                             |

### Verification states

```text
pending -> verified
pending -> revoked
verified -> revoked
```

- `pending`: registered but not yet verified; cannot receive production mail or create active identities.
- `verified`: ownership verification succeeded; identities may be created and routed.
- `revoked`: no longer usable; existing identities must not accept new mail while the domain is revoked.

When a domain is created, Nymveil returns a one-time verification token and the
TXT record name/value to the authenticated owner. The owner publishes that TXT
record in DNS and asks Nymveil to verify it. Nymveil hashes the token at rest,
checks the DNS record through a DNS-over-HTTPS resolver, and clears the stored
hash after successful verification. A new token can be issued only while the
domain is pending; issuing one invalidates the previous token.

Cloudflare Email Routing onboarding is a separate deployment step. Cloudflare
must be configured to receive mail for the verified domain and route it to the
Nymveil Worker; the Nymveil TXT challenge proves application-level ownership
but does not configure Cloudflare MX, SPF, or DKIM records.

Revocation is a safety state. Re-verification may be introduced later as an explicit product decision; it is not assumed by the MVP.

### Domain constraints and indexes

- `hostname` is globally unique after normalization.
- `userId` is indexed for ownership-scoped listing.
- `status` is indexed for filtering usable domains.
- Verification material is not included in normal domain read models.

The MVP assumes one owner per domain. Domain sharing and team ownership are out of scope.

## Email identities

An email identity is a user-owned address on a verified domain.

### Fields

| Field       | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `id`        | Opaque immutable identity id                       |
| `userId`    | Owning Better Auth user id                         |
| `domainId`  | Parent domain id                                   |
| `localPart` | Normalized address local part                      |
| `address`   | Canonical full address used for inbound lookup     |
| `label`     | User-provided purpose or service label             |
| `status`    | Identity lifecycle state                           |
| `expiresAt` | Expiration time, nullable for permanent identities |
| `torchedAt` | Permanent revocation time, nullable                |
| `createdAt` | Creation time                                      |
| `updatedAt` | Last mutation time                                 |

### Lifecycle states

```text
active -> expired
active -> torched
expired -> torched
```

- `active`: eligible for inbound routing if its domain is verified and it has an enabled destination.
- `expired`: no longer eligible for routing; it remains visible to its owner until retention/cleanup policy removes it.
- `torched`: permanently revoked; it cannot be reactivated or reused.

Expiration is a derived time rule as well as a persisted status. Inbound routing must reject an identity when `expiresAt` is reached, even if a scheduled job has not yet changed `status` to `expired`.

Permanent identities use `expiresAt = NULL`. The `torched` state, not a special expiration value, represents permanent revocation.

### Identity constraints and indexes

- `address` has a globally unique constraint. This is the authoritative inbound lookup key.
- `domainId` and `localPart` also have a unique constraint together to protect domain-scoped address allocation.
- `userId` is indexed for ownership checks and dashboard listing.
- `domainId` is indexed for domain-scoped lookups.
- `status` and `expiresAt` are indexed for cleanup and routing eligibility queries.
- `torchedAt` is set only when entering `torched` and is never cleared.

Address allocation must use cryptographically secure randomness and handle uniqueness conflicts by retrying within a bounded limit.

## Destinations

A destination is a user-owned delivery target, such as Discord or Telegram.

### Fields

| Field       | Meaning                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `id`        | Opaque immutable destination id                                          |
| `userId`    | Owning Better Auth user id                                               |
| `provider`  | Stable provider key: `dashboard`, `discord`, `telegram`, or a future key |
| `label`     | User-facing destination name                                             |
| `targetRef` | Provider account or target id; never a provider secret                   |
| `enabled`   | Whether the destination may receive delivery                             |
| `createdAt` | Creation time                                                            |
| `updatedAt` | Last mutation time                                                       |

The dashboard destination has no external target and therefore uses `targetRef = NULL`. Provider-specific credential values are stored separately from destination metadata as application-encrypted ciphertext. The encryption key is supplied through deployment secret configuration and is never persisted in the database.

Destinations are independently enableable. A configured destination is not automatically selected for every identity.

## Identity destinations

An identity may deliver to multiple destinations, and a destination may serve multiple identities. This is an explicit many-to-many relationship represented by a junction table.

### Fields

| Field           | Meaning                     |
| --------------- | --------------------------- |
| `identityId`    | Referenced identity         |
| `destinationId` | Referenced destination      |
| `createdAt`     | Time the route was selected |

The pair `(identityId, destinationId)` is the primary key or an equivalent unique constraint. Both foreign keys must cascade when their parent relationship is deleted, subject to the identity tombstone policy.

Application authorization must verify that the identity and destination belong to the same user before creating the association. Database foreign keys protect existence; they do not replace this ownership check.

## Relationships

```text
user 1 ──── * domain
user 1 ──── * identity
user 1 ──── * destination
domain 1 ── * identity
identity * ── * destination
              through identity_destination
```

The database schema should define foreign keys for data integrity. Drizzle relations are query metadata and convenience; they do not replace database constraints or authorization checks. ([Drizzle relations documentation](https://orm.drizzle.team/docs/relations))

## Routing eligibility

An inbound message may route only when all of these conditions are true:

1. The canonical address resolves to an identity.
2. The identity status is `active`.
3. The identity has not reached `expiresAt`.
4. The parent domain status is `verified`.
5. The destination belongs to the same user.
6. The destination is enabled and selected for the identity.

The server evaluates these conditions using trusted state and server time. A client cannot override status, ownership, expiration, or destination eligibility.

## Delivery attempts

A delivery attempt is the metadata record for one inbound event and one selected destination. It contains no message body, headers, attachments, provider response, or secret.

### Fields

| Field           | Meaning                                               |
| --------------- | ----------------------------------------------------- |
| `id`            | Opaque immutable delivery-attempt id                  |
| `deliveryKey`   | Stable event-and-destination key used for idempotency |
| `userId`        | Owning Better Auth user id                            |
| `identityId`    | Identity that received the inbound event              |
| `destinationId` | Selected destination                                  |
| `provider`      | Provider key used for the attempt                     |
| `status`        | `pending`, `succeeded`, or `failed`                   |
| `attemptedAt`   | Time delivery processing began                        |
| `completedAt`   | Time the attempt reached a terminal state, nullable   |
| `errorCode`     | Bounded provider-neutral failure category, nullable   |
| `createdAt`     | Record creation time                                  |
| `updatedAt`     | Last metadata mutation time                           |

The `deliveryKey` is unique. A repeated inbound event for the same destination must not create a second successful delivery or send the notification again. Explicit retry processing may update the existing failed record and preserve its original key.

## Future extensions

The model intentionally leaves room for:

- Multiple domains per user.
- Additional domain verification methods.
- More provider types.
- Destination-specific routing preferences.
- User-controlled message retention policies.
- Team ownership and shared domains.

These extensions must preserve the MVP invariants rather than weakening ownership or address uniqueness.
