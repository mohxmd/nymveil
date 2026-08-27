export class NoNotificationChannelsError extends Error {
  readonly code = "NO_NOTIFICATION_CHANNELS";

  constructor() {
    super(
      "No notification channels selected. Configure defaultChannels or pass channels when sending.",
    );
    this.name = "NoNotificationChannelsError";
  }
}

export class NotificationHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NotificationHttpError";
    this.status = status;
  }
}

export class NotificationConfigurationError extends Error {
  readonly code = "INVALID_NOTIFICATION_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "NotificationConfigurationError";
  }
}
