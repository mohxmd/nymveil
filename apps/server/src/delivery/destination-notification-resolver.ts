import type { DestinationRecord } from "@nymveil/core";

import { createNymveilNotificationClient } from "./notifications";
import type { DestinationCredentialStore } from "../modules/destinations/ports";
import {
  discordDestinationConfiguration,
  telegramDestinationConfiguration,
} from "../modules/destinations/provider-config";

export function createDestinationNotificationResolver(credentials: DestinationCredentialStore) {
  return async (destination: DestinationRecord) => {
    if (destination.provider !== "discord" && destination.provider !== "telegram") {
      return null;
    }

    if (!destination.targetRef) return null;

    const configuration = await credentials.get(destination.id);
    if (!configuration) return null;

    if (destination.provider === "discord") {
      const parsed = discordDestinationConfiguration.safeParse(configuration);
      return parsed.success ? createNymveilNotificationClient({ discord: parsed.data }) : null;
    }

    const parsed = telegramDestinationConfiguration.safeParse(configuration);
    return parsed.success
      ? createNymveilNotificationClient({
          telegram: { ...parsed.data, chatId: destination.targetRef },
        })
      : null;
  };
}
