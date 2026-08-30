import type { CleanupRunResult, ExpirationCleanup } from "@nymveil/core";

export interface ScheduledCleanupJob {
  run(): Promise<CleanupRunResult>;
}

export function createScheduledCleanupHandler(job: ScheduledCleanupJob) {
  return async (_controller: ScheduledController): Promise<void> => {
    // Propagating the failure keeps the scheduled invocation observable and
    // allows the runtime's operational tooling to report the failed run.
    await job.run();
  };
}

export function asScheduledCleanupJob(
  cleanup: Pick<ExpirationCleanup, "run">,
): ScheduledCleanupJob {
  return cleanup;
}
