# @nymveil/notifications

An extensible, runtime-neutral notification client for delivering structured
messages through pluggable providers.

## Current channels

| Channel  | Configuration        | Delivery                 |
| -------- | -------------------- | ------------------------ |
| Slack    | `webhookUrl`         | Incoming webhook         |
| Discord  | `webhookUrl`         | Channel webhook          |
| Email    | `sendEmailAction`    | Injected email transport |
| Telegram | `botToken`, `chatId` | Bot API `sendMessage`    |
| Webhook  | `url`                | Custom HTTP endpoint     |

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

Provider configuration makes a channel available; it does not automatically
broadcast notifications. Set `defaultChannels` for normal delivery, or pass
`channels` for an individual notification. If neither is provided, `send()`
throws `NoNotificationChannelsError`.

## Telegram

Telegram delivery uses the Bot API directly and does not add an SDK dependency.
Plain text is used by default; `parseMode` can be set to `HTML` or `MarkdownV2`
when the message content is prepared for that format.

```ts
const notifications = new NotificationClient({
  telegram: {
    botToken: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID,
  },
  defaultChannels: ["telegram"],
});
```

## Custom providers

Add providers that are not built into the package without modifying the client.

```ts
import { NotificationClient, type NotificationProvider } from "@nymveil/notifications";

const telegramProvider: NotificationProvider = {
  async send(payload) {
    await telegramApi.sendMessage(payload.message);
    return { channel: "telegram", success: true };
  },
};

const notifications = new NotificationClient({
  defaultChannels: ["telegram"],
  providers: { telegram: telegramProvider },
});
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
