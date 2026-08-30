# Nymveil Security and Privacy Baseline

This document defines the minimum security and privacy requirements for the first Nymveil release. It applies to the core, server, database, web dashboard, infrastructure, and delivery providers.

## Security posture

Nymveil handles email addresses, routing rules, authentication data, provider configuration, and untrusted inbound email. The system must default to least privilege, data minimization, explicit ownership, and fail-closed routing.

Security-sensitive behavior must be enforced server-side. Client validation is for usability only and is never an authorization or routing boundary.

## Data classes and retention

| Class             | Examples                                                                 | MVP retention                                                                   |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Account data      | User id, email, authentication records, sessions                         | Retained while the account exists; deleted according to account deletion policy |
| Routing data      | Domain, identity address, owner, label, status, expiration, destinations | Retained while needed for routing and abuse prevention                          |
| Delivery metadata | Provider, status, timestamps, redacted error category                    | Short operational retention; exact period is configurable before launch         |
| Message content   | Subject, body, HTML, headers, attachment content                         | Not retained permanently by default                                             |
| Provider secrets  | Bot tokens, webhook secrets, API credentials                             | Never stored as ordinary plaintext database values                              |
| Security events   | Authentication failures, authorization denials, rate-limit events        | Retained only as long as needed for security investigation and operations       |

Full email content may exist transiently in memory while it is parsed and delivered. It must not be written to ordinary logs, durable storage, analytics, error reports, or delivery metadata by default.

## Scheduled retention cleanup

The maintenance job runs hourly and processes records in bounded batches of 100 items. Its default policy is:

- Expired identities are retained for 30 days, then permanently deleted.
- Completed delivery attempts are retained for 30 days, then permanently deleted.
- Pending delivery attempts are never removed by retention cleanup.
- Torched identities are never removed by expiry cleanup, preserving their permanent non-reuse state.
- Expiry reminders are disabled unless an application explicitly configures a reminder handler.

The retention periods and batch size are application configuration and must be reviewed before production launch. Cleanup failures must remain observable to the deployment runtime; a failed run must not be reported as successful.

## Email content handling

Inbound email is untrusted input. The server must:

- Apply maximum limits to the raw message, parsed text, HTML, and attachments.
- Reject or safely handle malformed MIME content.
- Avoid executing HTML, scripts, remote resources, or attachment content.
- Sanitize or render content according to the destination provider's safe format.
- Avoid retaining message bodies after delivery processing completes.
- Avoid exposing one recipient's message to another recipient or user.

Unknown, expired, and torched identities should be discarded as early as possible without storing their message content.

## Secrets and credentials

Provider credentials and application secrets must be supplied through deployment secret storage or an equivalent protected runtime binding.

Requirements:

- Never commit secrets to the repository.
- Never return secrets through API responses.
- Never include secrets in logs, traces, error messages, or analytics.
- Do not store provider credentials as ordinary plaintext user-owned database fields.
- Use encryption or deployment-managed secret references if user-configurable credentials are introduced later.
- Keep local environment files ignored and provide safe example files without real values.
- Rotate credentials when exposure is suspected.

## Authentication and authorization

- Authentication is required for dashboard and management API operations.
- Every protected operation must verify the authenticated user server-side.
- Every identity, domain, destination, and delivery-metadata lookup must enforce ownership.
- Authorization failures must not reveal whether another user's resource exists.
- Inbound email endpoints may be unauthenticated at the transport boundary, but routing must use server-owned state.
- Sensitive actions such as torch, credential changes, and domain changes must have explicit routes and validation.
- Session cookies must be secure, HTTP-only, appropriately scoped, and protected against cross-site misuse.

## Logging and observability

Logs and telemetry must be safe to inspect in production.

Never log:

- Email bodies or raw MIME messages.
- Attachment content.
- Passwords, session tokens, bot tokens, webhook secrets, or API credentials.
- Full provider configuration.
- Unnecessarily identifying owner data.

Safe event fields may include a request or delivery correlation id, operation name, provider name, outcome, duration, bounded error category, and non-sensitive resource identifiers where operationally necessary.

Errors shown to users must be safe and actionable without exposing stack traces, SQL, credentials, or internal infrastructure details.

## Abuse prevention

The first release must include:

- Rate limits for account-sensitive and identity-creation operations.
- A configurable maximum number of active identities per user.
- Input length and format limits for labels, domains, addresses, and provider configuration.
- Message, HTML, and attachment size limits.
- Provider delivery timeouts and bounded retries.
- Webhook signature or secret-token verification where a provider supports it.
- Origin and CORS restrictions for browser-facing APIs.
- Protection against identity enumeration through consistent not-found and authorization responses.
- Permanent non-reuse of torched identity addresses.
- Safe handling of duplicate inbound events where the delivery platform may retry.

Abuse controls must fail closed when configuration is missing or invalid. Limits may be relaxed deliberately for private deployments through documented configuration.

## Domain and routing safety

- Normalize and validate recipient addresses before lookup.
- Compare identity status and expiration using trusted server time.
- Treat torched identities as permanently invalid.
- Deliver only to explicitly enabled destinations selected for that identity.
- Isolate failures between independent destinations.
- Do not allow a client to select another user's identity or destination by changing an id in the request.

## Operational requirements before launch

Before the first production deployment, the project must have:

- A documented retention period for delivery metadata and security events.
- A secret-management and rotation procedure.
- A deployment checklist that verifies secure cookies, CORS, webhook verification, and rate limits.
- Tests for ownership isolation, expired and torched routing, secret redaction, size limits, and provider failure behavior.
- A documented process for responding to exposed credentials or accidental message-content logging.

## Review rule

When a feature conflicts with convenience and privacy, the default decision is to retain less data, expose less information, require explicit user configuration, and fail closed.
