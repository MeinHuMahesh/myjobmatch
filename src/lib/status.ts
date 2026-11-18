import { config } from "./config";
import { countJobs } from "./db";
import { nextCronDate } from "./schedule";
import { getScrapeSnapshot } from "./scrape-state";

export function getStatusSnapshot() {
  return {
    ...getScrapeSnapshot(),
    totalJobs: countJobs(),
    nextRunAt: nextCronDate(config.cron)?.toISOString() ?? null,
    cron: config.cron,
    minIntervalHours: config.minIntervalHours,
  };
}

export type StatusSnapshot = ReturnType<typeof getStatusSnapshot>;
