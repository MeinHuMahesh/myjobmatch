import cron from "node-cron";
import { config } from "../src/lib/config";
import { nextCronDate } from "../src/lib/schedule";
import {
  hoursSinceLastSuccess,
  isDue,
  isScrapeRunning,
  runScrape,
} from "../src/lib/scrape-service";

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.log(`[scheduler ${time}] ${message}`);
}

async function tick(source: string): Promise<void> {
  if (isScrapeRunning()) {
    log(`A scrape is already running; skipping ${source} tick.`);
    return;
  }
  if (!isDue()) {
    const hours = hoursSinceLastSuccess();
    log(
      `Not due yet (last success ${hours?.toFixed(1)}h ago, interval ${config.minIntervalHours}h); skipping ${source} tick.`,
    );
    return;
  }
  log(`Starting ${source} fetch…`);
  try {
    const result = await runScrape({ onProgress: log });
    if (result.skipped) {
      log(`Skipped: ${result.reason}`);
    } else {
      log(
        `Fetch complete: ${result.summary.jobsFound} jobs (${result.summary.jobsNew} new, ` +
          `${result.summary.jobsUpdated} updated).`,
      );
    }
  } catch (error) {
    log(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function main(): void {
  if (!cron.validate(config.cron)) {
    console.error(`Invalid SCRAPE_CRON expression: "${config.cron}"`);
    process.exit(1);
  }

  const next = nextCronDate(config.cron);
  log(`Scheduler running. Cron "${config.cron}".`);
  log(`Next scheduled run: ${next ? next.toString() : "unknown"}`);
  log(`Minimum interval between fetches: ${config.minIntervalHours}h.`);

  cron.schedule(config.cron, () => {
    void tick("scheduled");
  });

  // On startup, catch up if a fetch is already due.
  setTimeout(() => {
    void tick("startup");
  }, 5000);

  const shutdown = (signal: string) => {
    log(`Received ${signal}. Shutting down scheduler.`);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
