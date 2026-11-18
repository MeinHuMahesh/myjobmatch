export type Chance = "High" | "Medium" | "Low";

export type JdStatus = "missing" | "ok" | "ocr" | "empty" | "failed";
export type JdSource = "native" | "ocr" | "mixed";

export interface DetailStats {
  fetched: number;
  reused: number;
  failed: number;
  ocrPages: number;
}

export interface DetailProgress extends DetailStats {
  active: number;
}

export interface EducationEntry {
  degree: string;
  specialization: string | null;
  institution: string | null;
  year: string | null;
  score: string | null;
}

export interface ResumeProfile {
  fileName: string;
  rawText: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  degree: string | null;
  branch: string | null;
  cgpa: number | null;
  graduationYear: number | null;
  education: EducationEntry[];
  skills: string[];
  targetRoles: string[];
  experienceMonths: number;
  projects: string[];
  certifications: string[];
  updatedAt: string;
}

export interface JobRecord {
  id: number;
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  jobType: string | null;
  ctc: string | null;
  stipend: string | null;
  eligibleBranches: string[];
  eligibleDegrees: string[];
  minCgpa: number | null;
  graduationYears: number[];
  deadline: string | null;
  description: string | null;
  applyUrl: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  rawText: string;
  jdStatus: JdStatus;
  jdSource: JdSource | null;
  jdFetchedAt: string | null;
  jdCharCount: number;
  jdError: string | null;
  jdPdfPath: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface EligibilityCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface ScoreBreakdown {
  total: number;
  chance: Chance;
  eligible: boolean;
  summary: string;
  skillScore: number;
  roleScore: number;
  experienceScore: number;
  matchedSkills: string[];
  missingMustHave: string[];
  missingNiceToHave: string[];
  checks: EligibilityCheck[];
}

export interface ScoredJob extends JobRecord {
  score: ScoreBreakdown | null;
}

/**
 * Trimmed projection of a job used by the dashboard list.
 * Deliberately excludes `description` / `rawText` (the bulk of the payload)
 * and the detail-only eligibility columns.
 */
export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location: string | null;
  jobType: string | null;
  ctc: string | null;
  stipend: string | null;
  deadline: string | null;
  requiredSkills: string[];
  score: ScoreBreakdown | null;
}

export type JobSort = "score" | "deadline" | "recent" | "company";

export interface JobListResult {
  jobs: JobSummary[];
  totalJobs: number;
  eligibleCount: number;
  matched: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  hasResume: boolean;
}

export interface ScrapeRun {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error";
  jobsFound: number;
  jobsNew: number;
  jobsUpdated: number;
  error: string | null;
}

export interface ScrapeStatus {
  isRunning: boolean;
  lastRun: ScrapeRun | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  totalJobs: number;
}

export interface ScrapeProgressInfo {
  phase: string;
  message: string;
  done?: number;
  total?: number;
}

/** Shape returned by `/api/scrape/status` and rendered in the dashboard header. */
export interface ScrapeStatusInfo {
  totalJobs: number;
  isRunning: boolean;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  hoursSinceLastSuccess: number | null;
  lastRun: ScrapeRun | null;
  progress: ScrapeProgressInfo | null;
  cron: string;
  minIntervalHours: number;
}

export interface ScrapeSummary {
  runId: number;
  jobsFound: number;
  jobsNew: number;
  jobsUpdated: number;
  durationMs: number;
  detailsFetched: number;
  detailsReused: number;
  detailsFailed: number;
  ocrPages: number;
}

export interface RawJobRow {
  cells: Record<string, string>;
  rawText: string;
  applyUrl?: string;
  detailText?: string;
  jdStatus?: JdStatus;
  jdSource?: JdSource;
  jdFetchedAt?: string;
  jdCharCount?: number;
  jdError?: string;
  jdPdfPath?: string;
  jdOcrPages?: number[];
}
