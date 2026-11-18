import path from "node:path";

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() !== "false" && value !== "0";
}

export const config = {
  portalUrl: process.env.PORTAL_URL ?? "https://ep.iitb.ac.in/jobsearch",
  cron: process.env.SCRAPE_CRON ?? "0 6 * * *",
  minIntervalHours: num(process.env.SCRAPE_MIN_INTERVAL_HOURS, 24),
  headless: bool(process.env.HEADLESS, true),
  maxPages: num(process.env.SCRAPE_MAX_PAGES, 50),
  throttleMs: num(process.env.SCRAPE_THROTTLE_MS, 800),
  scrapeDetails: bool(process.env.SCRAPE_DETAILS, true),
  refreshDetails: bool(process.env.SCRAPE_REFRESH_DETAILS, false),
  detailConcurrency: Math.max(
    1,
    Math.min(5, Math.floor(num(process.env.SCRAPE_DETAIL_CONCURRENCY, 3))),
  ),
  detailTimeoutMs: num(process.env.SCRAPE_DETAIL_TIMEOUT_MS, 20_000),
  detailRetries: Math.max(0, Math.floor(num(process.env.SCRAPE_DETAIL_RETRIES, 1))),
  jdRefreshHours: Math.max(0, num(process.env.SCRAPE_JD_REFRESH_HOURS, 168)),
  storePdfs: bool(process.env.SCRAPE_STORE_PDFS, true),
  ocrEnabled: bool(process.env.OCR_ENABLED, true),
  ocrLang: process.env.OCR_LANG ?? "eng",
  ocrMinCharsPerPage: Math.max(0, num(process.env.OCR_MIN_CHARS_PER_PAGE, 40)),
  ocrScale: Math.max(1, num(process.env.OCR_SCALE, 2)),
  captureNetwork: bool(process.env.SCRAPE_CAPTURE_NETWORK, false),
  dbPath:
    process.env.DATABASE_PATH ??
    path.join(process.cwd(), "db", "jobs.db"),
  rawDir: process.env.RAW_DIR ?? path.join(process.cwd(), "db", "raw"),
  pdfDir: process.env.JD_PDF_DIR ?? path.join(process.cwd(), "db", "jd"),
  ocrCacheDir:
    process.env.OCR_CACHE_DIR ??
    path.join(process.cwd(), "db", "tesseract-cache"),
};
