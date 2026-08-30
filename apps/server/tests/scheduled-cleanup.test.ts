import { describe, expect, test } from "bun:test";

import { createScheduledCleanupHandler } from "../src/maintenance/cleanup";

describe("scheduled cleanup handler", () => {
  test("runs the cleanup job", async () => {
    let runCount = 0;
    const handler = createScheduledCleanupHandler({
      run: async () => {
        runCount += 1;
        return {
          expiredIdentityCount: 1,
          deletedIdentityCount: 0,
          deletedDeliveryMetadataCount: 0,
          expiryReminderCount: 0,
        };
      },
    });

    await handler({} as ScheduledController);

    expect(runCount).toBe(1);
  });

  test("propagates cleanup failures", async () => {
    const failure = new Error("database unavailable");
    const handler = createScheduledCleanupHandler({
      run: async () => {
        throw failure;
      },
    });

    await expect(handler({} as ScheduledController)).rejects.toBe(failure);
  });
});
