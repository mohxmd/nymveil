export class NoNotificationChannelsError extends Error {
  readonly code = "NO_NOTIFICATION_CHANNELS";

  constructor() {
    super(
      "No notification channels selected. Configure defaultChannels or pass channels when sending.",
    );
    this.name = "NoNotificationChannelsError";
  }
}
