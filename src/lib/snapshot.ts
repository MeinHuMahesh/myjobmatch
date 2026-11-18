import data from "@/../public/data/jobs.json";
import type {
  JobListResult,
  JobSort,
  JobSummary,
  ScoreBreakdown,
  ScoredJob,
} from "./types";

export const snapshotGeneratedAt: string = data.generatedAt;
export const snapshotJobs = data.jobs as ScoredJob[];

export interface SnapshotQuery {
  q?: string;
  minScore?: number;
  eligible?: boolean;
  chance?: string | null;
  sort?: string | null;
  offset?: number;
  limit?: number;
}

export function getSnapshotJob(id: number): ScoredJob | undefined {
  return snapshotJobs.find((job) => job.id === id);
}

export function toJobSummary(
  job: ScoredJob,
  score: ScoreBreakdown | null = job.score,
): JobSummary {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    jobType: job.jobType,
    ctc: job.ctc,
    stipend: job.stipend,
    deadline: job.deadline,
    requiredSkills: job.requiredSkills,
    score,
  };
}

function normalizeSort(sort: string | null | undefined): JobSort {
  if (sort === "deadline" || sort === "recent" || sort === "company") return sort;
  return "score";
}

function compareJobs(a: JobSummary, b: JobSummary, sort: JobSort): number {
  if (sort === "deadline") {
    const da = a.deadline ? Date.parse(a.deadline) : Number.MAX_SAFE_INTEGER;
    const db = b.deadline ? Date.parse(b.deadline) : Number.MAX_SAFE_INTEGER;
    return da - db;
  }
  if (sort === "recent") {
    const ra = getSnapshotJob(a.id)?.firstSeenAt ?? "";
    const rb = getSnapshotJob(b.id)?.firstSeenAt ?? "";
    return rb.localeCompare(ra);
  }
  if (sort === "company") return a.company.localeCompare(b.company);
  return (b.score?.total ?? -1) - (a.score?.total ?? -1);
}

export function querySnapshotJobs(
  query: SnapshotQuery = {},
  scores?: ReadonlyMap<number, ScoreBreakdown>,
): JobListResult {
  const needle = (query.q ?? "").trim().toLowerCase();
  const minScore = Number(query.minScore ?? 0);
  const eligibleOnly = Boolean(query.eligible);
  const chance = query.chance ?? null;
  const sort = normalizeSort(query.sort);
  const offset = Math.max(0, Math.floor(Number(query.offset ?? 0)));
  const limit = Math.max(1, Math.floor(Number(query.limit ?? 50)));

  const all = snapshotJobs.map((job) => toJobSummary(job, scores?.get(job.id) ?? job.score));
  const eligibleCount = all.filter((job) => job.score?.eligible).length;

  let jobs = all;
  if (eligibleOnly) jobs = jobs.filter((job) => job.score?.eligible);
  if (Number.isFinite(minScore) && minScore > 0) {
    jobs = jobs.filter((job) => (job.score?.total ?? -1) >= minScore);
  }
  if (chance) jobs = jobs.filter((job) => job.score?.chance === chance);
  if (needle) {
    jobs = jobs.filter((job) => {
      const full = getSnapshotJob(job.id);
      return [job.title, job.company, job.location ?? "", ...job.requiredSkills, full?.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }

  jobs = [...jobs].sort((a, b) => compareJobs(a, b, sort));

  const page = jobs.slice(offset, offset + limit);
  return {
    jobs: page,
    totalJobs: all.length,
    eligibleCount,
    matched: jobs.length,
    offset,
    limit,
    hasMore: offset + page.length < jobs.length,
    hasResume: Boolean(scores && scores.size > 0),
  };
}
