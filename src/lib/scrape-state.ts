import { config } from "./config";
import {
  getLastRun,
  getLastSuccessAt,
  getMeta,
  getRecentRuns,
  setMeta,
} from "./db";
import type { DetailProgress, ScrapeStatusInfo } from "./types";

const STALE_RUN_MS = 30 * 60 * 1000;
const PROGRESS_KEY = "scrape_progress";

export interface ScrapeProgress extends Partial<DetailProgress> {
  phase: string;
  message: string;
  done?: number;
  total?: number;
}

export function isScrapeRunning(): boolean {
  const running = getRecentRuns(5).find((run) => run.status === "running");
  if (!running) return false;
  return Date.now() - Date.parse(running.startedAt) < STALE_RUN_MS;
}

export function hoursSinceLastSuccess(): number | null {
  const last = getLastSuccessAt();
  if (!last) return null;
  const diff = Date.now() - Date.parse(last);
  if (!Number.isFinite(diff)) return null;
  return diff / (60 * 60 * 1000);
}

export function isDue(): boolean {
  const hours = hoursSinceLastSuccess();
  if (hours === null) return true;
  return hours >= config.minIntervalHours;
}

export function writeProgress(progress: ScrapeProgress | null): void {
  setMeta(PROGRESS_KEY, progress ? JSON.stringify(progress) : "");
}

export function readProgress(): ScrapeProgress | null {
  const raw = getMeta(PROGRESS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScrapeProgress;
  } catch {
    return null;
  }
}

export function getScrapeSnapshot(): Omit<ScrapeStatusInfo, "totalJobs" | "nextRunAt" | "cron" | "minIntervalHours"> {
  const isRunning = isScrapeRunning();
  return {
    lastRun: getLastRun(),
    lastSuccessAt: getLastSuccessAt(),
    isRunning,
    hoursSinceLastSuccess: hoursSinceLastSuccess(),
    progress: isRunning ? readProgress() : null,
  };
}
