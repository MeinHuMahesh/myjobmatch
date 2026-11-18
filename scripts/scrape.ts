import { runScrape } from "../src/lib/scrape-service";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const details = args.has("--no-details")
  ? false
  : args.has("--details")
    ? true
    : undefined;
const refreshDetails = args.has("--refresh-details");

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message}`);
}

async function main(): Promise<void> {
  log(
    `Starting scrape${force ? " (forced)" : ""}` +
      `${details === false ? " without details" : ""}` +
      `${refreshDetails ? " (refresh all JDs)" : ""}…`,
  );
  try {
    const result = await runScrape({
      force,
      details,
      refreshDetails,
      onProgress: log,
    });
    if (result.skipped) {
      log(`Skipped: ${result.reason}`);
      return;
    }
    log(
      `Done. Found ${result.summary.jobsFound}, new ${result.summary.jobsNew}, ` +
        `updated ${result.summary.jobsUpdated}, ` +
        `JDs fetched ${result.summary.detailsFetched}, ` +
        `reused ${result.summary.detailsReused}, ` +
        `failed ${result.summary.detailsFailed}, ` +
        `OCR pages ${result.summary.ocrPages} ` +
        `in ${(result.summary.durationMs / 1000).toFixed(1)}s.`,
    );
  } catch (error) {
    console.error("Scrape failed:", error);
    process.exitCode = 1;
  }
}

main();
