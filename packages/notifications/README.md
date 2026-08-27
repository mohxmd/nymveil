# @nymveil/notifications

An extensible, runtime-neutral notification client for delivering structured
messages through pluggable providers.

## Current channels

| Channel | Configuration     | Delivery                 |
| ------- | ----------------- | ------------------------ |
| Slack   | `webhookUrl`      | Incoming webhook         |
| Discord | `webhookUrl`      | Channel webhook          |
| Email   | `sendEmailAction` | Injected email transport |
| Webhook | `url`             | Custom HTTP endpoint     |

## Quick start

```ts
import { NotificationClient } from "@nymveil/notifications";

const notifications = new NotificationClient({
  discord: { webhookUrl: DISCORD_WEBHOOK_URL },
  slack: { webhookUrl: SLACK_WEBHOOK_URL },
  defaultChannels: ["discord", "slack"],
  defaultRetries: 2,
});

const payload = {
  title: "Identity expiring",
  message: "github-k7x2@yourdomain.com expires tomorrow.",
  priority: "high" as const,
  metadata: { address: "github-k7x2@yourdomain.com" },
};

const results = await notifications.send(payload);

// A send can target a different set of channels.
await notifications.send(payload, { channels: ["discord"] });

// Or target one configured channel directly.
await notifications.sendToChannel("slack", payload);
```

## Email

Email delivery uses an injected function, so the package does not require a
specific email vendor.

```ts
import { NotificationClient } from "@nymveil/notifications";

const notifications = new NotificationClient({
  email: {
    defaultTo: "alerts@example.com",
    from: "Notifications <alerts@example.com>",
    sendEmailAction: async (payload) => emailTransport.send(payload),
  },
});

await notifications.sendToChannel("email", {
  title: "Welcome",
  message: "Your notification channel is ready.",
});

// Override the configured recipient for one notification.
await notifications.sendToChannel("email", {
  title: "Identity created",
  message: "Your new identity is ready.",
  metadata: { to: "user@example.com" },
});
```

## Reliability and safety

- Configurable exponential retries with jitter
- Request timeouts
- Isolated channel failures through `Promise.allSettled`
- HTTP/HTTPS validation for webhook destinations
- Bounded provider-specific payloads
- Provider-specific formatting while sharing one payload model

## Public API

`NotificationClient` exposes:

- `send(payload, options?)`
- `sendToChannel(channel, payload)`
- `hasChannel(channel)`
- `getConfiguredChannels()`

The package deliberately does not own authentication, recipient storage,
notification history, queues, or application-specific event models. Those can
be composed around the client by each application.
