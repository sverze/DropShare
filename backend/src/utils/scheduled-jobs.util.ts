const DISABLED =
  (process.env.DISABLE_SCHEDULED_JOBS || "").trim().toLowerCase() === "true";

export const scheduledJobsDisabled = (): boolean => DISABLED;

export function skipScheduledJob(
  logger: { debug: (_m: string) => void },
  job: string,
): boolean {
  if (!DISABLED) return false;
  logger.debug(`Skipping ${job}: DISABLE_SCHEDULED_JOBS is set`);
  return true;
}
