import crypto from "node:crypto";
import { config } from "./config";
import {
  finishScrapeRun,
  getResume,
  listJobs,
  saveScore,
  startScrapeRun,
  upsertJobs,
  type JobInput,
} from "./db";
import {
  detectBranches,
  detectDegrees,
  extractCgpa,
  extractCtc,
  extractDeadline,
  extractGraduationYears,
  extractJobType,
  extractLocation,
  extractPreferredSkills,
  extractRequiredSkills,
  extractStipend,
} from "./extract";
import {
  hoursSinceLastSuccess,
  isDue,
  isScrapeRunning,
  writeProgress,
} from "./scrape-state";
import { scoreJob } from "./scoring";
import { scrapeJobs } from "./scraper";
import type { RawJobRow, ScrapeSummary } from "./types";

export {
  getScrapeSnapshot,
  hoursSinceLastSuccess,
  isDue,
  isScrapeRunning,
  readProgress,
  writeProgress,
  type ScrapeProgress,
} from "./scrape-state";


function hash(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 24);
}

function firstNonEmpty(...values: (string | undefined | null)[]): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function guessTitle(row: RawJobRow): string {
  const fromCell = firstNonEmpty(row.cells.title, row.cells.profile, row.cells.role);
  if (fromCell) return fromCell;
  const segments = row.rawText.split(/\s*\|\s*/).filter(Boolean);
  const candidate = segments.find(
    (segment) =>
      /engineer|developer|analyst|intern|manager|scientist|consultant|design|associate|lead|architect/i.test(
        segment,
      ) && segment.length < 80,
  );
  return candidate ?? segments[1] ?? segments[0] ?? "Unknown role";
}

function guessCompany(row: RawJobRow): string {
  const fromCell = firstNonEmpty(row.cells.company, row.cells.employer, row.cells.organization);
  if (fromCell) return fromCell;
  const segments = row.rawText.split(/\s*\|\s*/).filter(Boolean);
  return segments[0] ?? "Unknown company";
}

export function normalizeRow(row: RawJobRow): JobInput {
  const text = [row.rawText, row.detailText].filter(Boolean).join("\n");
  const title = guessTitle(row);
  const company = guessCompany(row);
  const referenceCode = firstNonEmpty(row.cells.referenceCode);
  const category = firstNonEmpty(row.cells.category, row.cells.jobType);
  const startDate = firstNonEmpty(row.cells.startDate, row.cells.openedOn);
  const deadline = firstNonEmpty(row.cells.deadline, extractDeadline(text));
  const location = firstNonEmpty(row.cells.location, extractLocation(text));
  const jobType = firstNonEmpty(category, extractJobType(text));
  const ctc = firstNonEmpty(row.cells.ctc, extractCtc(text));
  const stipend = firstNonEmpty(row.cells.stipend, extractStipend(text));
  const branches = detectBranches(
    firstNonEmpty(row.cells.eligibleBranches, "") ?? text,
  );
  const degrees = detectDegrees(text);
  const minCgpa = extractCgpa(firstNonEmpty(row.cells.cgpa, "") ?? text);
  const graduationYears = extractGraduationYears(
    firstNonEmpty(row.cells.graduationYears, "") ?? text,
  );
  const requiredSkills = extractRequiredSkills(text);
  const preferredSkills = extractPreferredSkills(text);

  const externalId = referenceCode
    ? `iitb:${referenceCode.toLowerCase()}`
    : hash(`${company.toLowerCase()}|${title.toLowerCase()}|${deadline ?? ""}`);

  const descriptionLines = [
    category ? `Category: ${category}` : null,
    referenceCode ? `Reference code: ${referenceCode}` : null,
    startDate ? `Applications open: ${startDate}` : null,
    deadline ? `Last date to apply: ${deadline}` : null,
  ].filter((line): line is string => Boolean(line));
  const description =
    row.detailText ?? (descriptionLines.length > 0 ? descriptionLines.join("\n") : row.rawText);

  const jdStatus = row.jdStatus ?? (row.detailText ? "ok" : "missing");
  const jdSource = row.jdSource ?? (row.detailText ? "native" : null);
  const jdFetchedAt =
    row.jdFetchedAt ?? (row.detailText ? new Date().toISOString() : null);
  const jdCharCount = row.jdCharCount ?? row.detailText?.length ?? 0;

  return {
    externalId,
    title,
    company,
    location,
    jobType,
    ctc,
    stipend,
    eligibleBranches: branches,
    eligibleDegrees: degrees,
    minCgpa,
    graduationYears,
    deadline,
    description,
    applyUrl: row.applyUrl ?? null,
    requiredSkills,
    preferredSkills,
    rawText: row.rawText,
    jdStatus,
    jdSource,
    jdFetchedAt,
    jdCharCount,
    jdError: row.jdError ?? null,
    jdPdfPath: row.jdPdfPath ?? null,
  };
}

export function rescoreAll(): number {
  const resume = getResume();
  if (!resume) return 0;
  const jobs = listJobs();
  for (const job of jobs) {
    saveScore(job.id, resume.updatedAt, scoreJob(resume, job));
  }
  return jobs.length;
}

export interface RunScrapeOptions {
  force?: boolean;
  details?: boolean;
  refreshDetails?: boolean;
  onProgress?: (message: string) => void;
}

export type RunScrapeResult =
  | { skipped: true; reason: string }
  | { skipped: false; summary: ScrapeSummary };

export async function runScrape(
  options: RunScrapeOptions = {},
): Promise<RunScrapeResult> {
  if (isScrapeRunning()) {
    return { skipped: true, reason: "A scrape is already running." };
  }
  if (!options.force && !isDue()) {
    writeProgress(null);
    const hours = hoursSinceLastSuccess();
    return {
      skipped: true,
      reason: `Last successful fetch was ${hours?.toFixed(1)}h ago (interval is ${config.minIntervalHours}h). Use force to override.`,
    };
  }

  const startedAt = Date.now();
  const runId = startScrapeRun();
  const log = (message: string): void => {
    writeProgress({ phase: "scraping", message });
    options.onProgress?.(message);
  };

  try {
    log("Launching headless browser…");
    const existingJobs = listJobs();
    const scrape = await scrapeJobs({
      details: options.details,
      refreshDetails: options.refreshDetails,
      existingJobs,
      onProgress: log,
      onDetailProgress: (done, total, progress) => {
        const message =
          total === 0
            ? `${progress.reused} job descriptions already cached`
            : `Fetching job descriptions ${done}/${total}` +
              (progress.reused ? ` · ${progress.reused} cached` : "") +
              (progress.failed ? ` · ${progress.failed} failed` : "") +
              (progress.ocrPages ? ` · ${progress.ocrPages} OCR pages` : "");
        writeProgress({
          phase: "details",
          message,
          done,
          total,
          ...progress,
        });
        options.onProgress?.(message);
      },
    });
    const rows = scrape.rows;
    log(`Collected ${rows.length} raw rows. Normalizing…`);

    const normalized: JobInput[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const job = normalizeRow(row);
      if (seen.has(job.externalId)) continue;
      seen.add(job.externalId);
      normalized.push(job);
    }

    const { inserted, updated } = upsertJobs(normalized);
    log(`Saved ${inserted} new and ${updated} updated jobs.`);

    const rescored = rescoreAll();
    if (rescored > 0) log(`Recomputed scores for ${rescored} jobs.`);

    finishScrapeRun(runId, {
      status: "success",
      jobsFound: normalized.length,
      jobsNew: inserted,
      jobsUpdated: updated,
      error: null,
    });
    writeProgress(null);

    return {
      skipped: false,
      summary: {
        runId,
        jobsFound: normalized.length,
        jobsNew: inserted,
        jobsUpdated: updated,
        durationMs: Date.now() - startedAt,
        detailsFetched: scrape.details.fetched,
        detailsReused: scrape.details.reused,
        detailsFailed: scrape.details.failed,
        ocrPages: scrape.details.ocrPages,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishScrapeRun(runId, {
      status: "error",
      jobsFound: 0,
      jobsNew: 0,
      jobsUpdated: 0,
      error: message,
    });
    writeProgress(null);
    throw error;
  }
}

