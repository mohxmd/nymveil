# @nymveil/core

The framework-independent domain layer for Nymveil.

This package owns product rules and use cases. It must not depend on Hono, Cloudflare, Drizzle, Turso, Discord, Telegram, SvelteKit, or any other infrastructure provider.

The package is implemented incrementally from the product contract and security baseline.

## Dependency boundary

The core accepts persistence, time, and randomness through small ports. Adapters in
other packages provide those implementations. This package must remain independent
from Hono, Cloudflare, Drizzle, Turso, Discord, Telegram, SvelteKit, and framework
runtime APIs.

## Identity lifecycle

Identity transitions are intentionally one-way:

```text
active -> expired
active -> torched
expired -> torched
```

Expiration is checked with trusted server time and can be materialized by a use case
or scheduled job. Torching is permanent and the address must never be reused.
