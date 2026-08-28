# Nymveil MVP Product Contract

This document defines the behavior and boundaries of the first Nymveil release. Product behavior described here is the reference for implementation, tests, and user-facing documentation.

## Product promise

Nymveil lets an authenticated user create an isolated email identity on an approved custom domain, use it with an external service, receive messages through explicitly selected destinations, and permanently disable the identity when it is no longer trusted.

The default safety posture is to minimize message retention and make every delivery destination explicit.

## Primary user journey

1. The user creates an account or signs in.
2. The user configures an approved custom domain.
3. The user creates an email identity for a service or purpose.
4. The user assigns a label and optional expiration time.
5. The user selects one or more enabled delivery destinations.
6. The user uses the identity with an external service.
7. Nymveil receives inbound mail addressed to that identity.
8. Nymveil validates the identity and delivers the message to the selected destinations.
9. The user reviews delivery metadata and may extend, expire, or torch the identity.

The web dashboard is the primary interface for the MVP. The authenticated API supports the dashboard and may be used by future clients.

## Identity contract

An identity belongs to exactly one authenticated user and one approved domain. Its address is unique within the configured domain.

An identity has:

- A generated local part and domain.
- A user-provided label.
- A lifecycle status.
- An optional expiration time.
- Zero or more explicitly selected destinations.
- Creation, update, expiration, and torch timestamps.

An identity cannot be transferred between users or domains after creation.

## Identity lifecycle

The MVP uses these states:

```text
active -> expired
active -> torched
expired -> torched
```

### Active

An active identity can receive mail and deliver it to its currently enabled destinations. Its owner can update its label, expiration, and destination selection.

### Expired

An identity becomes expired when its expiration time has passed. Expiration is evaluated during inbound processing and management operations; scheduled cleanup may materialize the state in the database.

An expired identity:

- Must not deliver inbound mail.
- Must remain distinguishable from an active identity for its owner.
- May be extended by its owner if the product allows extension before permanent cleanup.
- Cannot be used for new delivery until it becomes active again.

### Torched

Torching is a permanent user action that revokes the identity.

A torched identity:

- Must never receive or deliver mail again.
- Cannot be reactivated or edited.
- Must not be recreated with the same address.
- Remains as a minimal tombstone for abuse prevention, auditability, and address non-reuse.

Torching is stronger than expiration and is irreversible in the MVP.

## Expiration behavior

Expiration is optional when an identity is created. If no expiration is set, the identity remains active until the user torches it or a later product policy changes it.

The system must treat an identity as expired when the current time is equal to or later than its expiration time.

Expiration must be checked server-side. Client-provided status or timestamps are never trusted for routing decisions.

The MVP does not send expiration reminders unless that capability is added explicitly later.

## Destination behavior

Destinations are explicit, independently enableable delivery targets associated with the user.

An identity may select multiple destinations. Only destinations selected for that identity and enabled by the user are eligible for delivery.

Configured destinations must not receive every identity's messages automatically. This allows a user to route one identity to Discord, another to Telegram, and another to a future provider.

For each inbound message, Nymveil attempts delivery to all eligible selected destinations according to the delivery policy. A failure at one destination must not prevent independent destinations from being attempted.

The MVP supports Discord and Telegram delivery. Provider credentials are deployment secrets or protected configuration and must never be exposed through ordinary API responses.

## Inbound message behavior

For every inbound message, the server:

1. Normalizes the recipient address.
2. Resolves the identity without revealing another user's data.
3. Rejects unknown, expired, and torched identities.
4. Applies message, HTML, and attachment size limits.
5. Treats headers, body content, links, and attachments as untrusted input.
6. Delivers only to eligible selected destinations.
7. Records safe delivery metadata and redacted provider errors.

Unknown, expired, and torched recipients are discarded without permanent message storage by default.

## Privacy and retention defaults

The MVP must follow data minimization by default:

- Full message bodies are not permanently stored.
- Attachments are not permanently stored.
- Delivery metadata may be retained for operational visibility.
- Provider responses and errors must be redacted before persistence or logging.
- Logs must not contain message bodies, credentials, tokens, or sensitive destination configuration.
- Users must not be able to discover whether another user's identity exists.

Any future full-content retention feature must be explicit, user-controlled, time-limited, and documented separately.

## Authentication and ownership

Authentication is required for the dashboard and management API.

Every identity, domain, destination, and delivery-metadata query must enforce ownership server-side. Authorization failures must not disclose whether the requested resource exists for another user.

Inbound email processing may be unauthenticated at the HTTP boundary, but routing decisions must be based on server-owned identity and destination data.

## First-release scope

The MVP includes:

- Application authentication and sessions.
- Approved custom-domain support.
- Email identity creation and management.
- Labels and optional expiration.
- Permanent torch/revoke behavior.
- Authenticated identity management API.
- Web dashboard.
- Cloudflare inbound email processing.
- Discord and Telegram delivery.
- Delivery metadata.
- Minimal message retention.
- Scheduled expiration and cleanup.

## Out of scope for the first release

- Public hosted multi-tenant service operations.
- Automatic domain purchasing or registrar integration.
- Multiple advanced routing rules per identity.
- Full message inbox or permanent message content storage.
- Search indexing of message content.
- Attachments retained for later download.
- Chat-based identity management.
- CLI and SDK.
- Queue-backed or multi-region delivery orchestration.
- Custom provider development UI.
- Team accounts, sharing, and delegated administration.
- Billing, quotas, and paid plans.
- Email sending or reply-from-alias functionality.

## Decision rules

When implementation details are unclear, use these rules:

1. Prefer explicit user configuration over implicit broadcasting.
2. Reject invalid or unsafe input before provider delivery.
3. Keep identity and routing rules independent from infrastructure providers.
4. Minimize retained data.
5. Make irreversible actions obvious and permanent.
6. Never trade ownership isolation for convenience.
