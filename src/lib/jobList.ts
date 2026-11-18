import {
  getJobSearchIndex,
  getResume,
  listScoredJobSummaries,
} from "./db";
import type { JobListResult, JobSort, JobSummary } from "./types";

/** Jobs rendered into the server HTML on first paint. */
export const INITIAL_PAGE_SIZE = 20;
/** Page size for client-side filter / "load more" fetches. */
export const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface JobQuery {
  q?: string;
  minScore?: number;
  eligible?: boolean;
  chance?: string | null;
  sort?: string | null;
  offset?: number;
  limit?: number;
}

function scoreValue(job: JobSummary): number {
  return job.score?.total ?? -1;
}

function normalizeSort(sort: string | null | undefined): JobSort {
  if (sort === "deadline" || sort === "recent" || sort === "company") return sort;
  return "score";
}

function sortJobs(jobs: JobSummary[], sort: JobSort): void {
  jobs.sort((a, b) => {
    if (sort === "deadline") {
      const da = a.deadline ? Date.parse(a.deadline) : Number.MAX_SAFE_INTEGER;
      const db = b.deadline ? Date.parse(b.deadline) : Number.MAX_SAFE_INTEGER;
      return da - db;
    }
    if (sort === "recent") {
      return 0;
    }
    if (sort === "company") {
      return a.company.localeCompare(b.company);
    }
    return scoreValue(b) - scoreValue(a);
  });
}

export function queryJobSummaries(query: JobQuery = {}): JobListResult {
  const minScore = Number(query.minScore ?? 0);
  const eligibleOnly = Boolean(query.eligible);
  const chance = query.chance ?? null;
  const needle = (query.q ?? "").trim().toLowerCase();
  const sort = normalizeSort(query.sort);
  const offset = Math.max(0, Math.floor(Number(query.offset ?? 0)));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(query.limit ?? DEFAULT_PAGE_SIZE))),
  );

  const all = listScoredJobSummaries();
  const totalJobs = all.length;
  const eligibleCount = all.filter((job) => job.score?.eligible).length;

  let jobs = all;
  if (eligibleOnly) jobs = jobs.filter((job) => job.score?.eligible);
  if (Number.isFinite(minScore) && minScore > 0) {
    jobs = jobs.filter((job) => scoreValue(job) >= minScore);
  }
  if (chance) {
    jobs = jobs.filter((job) => job.score?.chance === chance);
  }
  if (needle) {
    const index = getJobSearchIndex();
    jobs = jobs.filter((job) => (index.get(job.id) ?? "").includes(needle));
  }

  // `listScoredJobSummaries` already returns newest-first, so "recent" is a no-op.
  sortJobs(jobs, sort);

  const matched = jobs.length;
  const page = jobs.slice(offset, offset + limit);

  return {
    jobs: page,
    totalJobs,
    eligibleCount,
    matched,
    offset,
    limit,
    hasMore: offset + page.length < matched,
    hasResume: Boolean(getResume()),
  };
}
