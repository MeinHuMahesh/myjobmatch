import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import type {
  EducationEntry,
  JdSource,
  JdStatus,
  JobRecord,
  JobSummary,
  ResumeProfile,
  ScoreBreakdown,
  ScoredJob,
  ScrapeRun,
} from "./types";

export type JobInput = Omit<JobRecord, "id" | "firstSeenAt" | "lastSeenAt">;

type DbValue = string | number | bigint | null;
type DbRow = Record<string, DbValue>;

const globalForDb = globalThis as unknown as { __jobsDb?: DatabaseSync };

function createSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS resume (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      file_name TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      degree TEXT,
      branch TEXT,
      cgpa REAL,
      graduation_year INTEGER,
      education TEXT NOT NULL DEFAULT '[]',
      skills TEXT NOT NULL DEFAULT '[]',
      target_roles TEXT NOT NULL DEFAULT '[]',
      experience_months INTEGER NOT NULL DEFAULT 0,
      projects TEXT NOT NULL DEFAULT '[]',
      certifications TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      job_type TEXT,
      ctc TEXT,
      stipend TEXT,
      eligible_branches TEXT NOT NULL DEFAULT '[]',
      eligible_degrees TEXT NOT NULL DEFAULT '[]',
      min_cgpa REAL,
      graduation_years TEXT NOT NULL DEFAULT '[]',
      deadline TEXT,
      description TEXT,
      apply_url TEXT,
      required_skills TEXT NOT NULL DEFAULT '[]',
      preferred_skills TEXT NOT NULL DEFAULT '[]',
      raw_text TEXT NOT NULL DEFAULT '',
      jd_status TEXT NOT NULL DEFAULT 'missing',
      jd_source TEXT,
      jd_fetched_at TEXT,
      jd_char_count INTEGER NOT NULL DEFAULT 0,
      jd_error TEXT,
      jd_pdf_path TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
      resume_updated_at TEXT,
      total REAL NOT NULL,
      chance TEXT NOT NULL,
      breakdown TEXT NOT NULL,
      computed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      jobs_found INTEGER NOT NULL DEFAULT 0,
      jobs_new INTEGER NOT NULL DEFAULT 0,
      jobs_updated INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const resumeColumns = db.prepare("PRAGMA table_info(resume)").all() as DbRow[];
  if (!resumeColumns.some((column) => column.name === "education")) {
    db.exec("ALTER TABLE resume ADD COLUMN education TEXT NOT NULL DEFAULT '[]'");
  }

  const jobColumns = db.prepare("PRAGMA table_info(jobs)").all() as DbRow[];
  const addJobColumn = (name: string, definition: string) => {
    if (!jobColumns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${definition}`);
    }
  };
  addJobColumn("jd_status", "TEXT NOT NULL DEFAULT 'missing'");
  addJobColumn("jd_source", "TEXT");
  addJobColumn("jd_fetched_at", "TEXT");
  addJobColumn("jd_char_count", "INTEGER NOT NULL DEFAULT 0");
  addJobColumn("jd_error", "TEXT");
  addJobColumn("jd_pdf_path", "TEXT");

  db.exec(`
    UPDATE jobs
    SET jd_status = 'ok',
        jd_source = 'native',
        jd_fetched_at = COALESCE(jd_fetched_at, last_seen_at),
        jd_char_count = length(description)
    WHERE jd_status = 'missing'
      AND description IS NOT NULL
      AND length(description) >= 500
  `);
}

export function getDb(): DatabaseSync {
  if (globalForDb.__jobsDb) return globalForDb.__jobsDb;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  fs.mkdirSync(config.rawDir, { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  createSchema(db);
  globalForDb.__jobsDb = db;
  return db;
}

function parseArray(value: DbValue): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseEducation(value: DbValue): EducationEntry[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        degree: String((item as Record<string, unknown>).degree ?? ""),
        specialization: toText(
          (item as Record<string, unknown>).specialization as DbValue,
        ),
        institution: toText((item as Record<string, unknown>).institution as DbValue),
        year: toText((item as Record<string, unknown>).year as DbValue),
        score: toText((item as Record<string, unknown>).score as DbValue),
      }))
      .filter((entry) => entry.degree.length > 0);
  } catch {
    return [];
  }
}

function toNumber(value: DbValue): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: DbValue): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function rowToJob(row: DbRow): JobRecord {
  return {
    id: Number(row.id),
    externalId: String(row.external_id),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    location: toText(row.location),
    jobType: toText(row.job_type),
    ctc: toText(row.ctc),
    stipend: toText(row.stipend),
    eligibleBranches: parseArray(row.eligible_branches),
    eligibleDegrees: parseArray(row.eligible_degrees),
    minCgpa: toNumber(row.min_cgpa),
    graduationYears: parseArray(row.graduation_years).map(Number),
    deadline: toText(row.deadline),
    description: toText(row.description),
    applyUrl: toText(row.apply_url),
    requiredSkills: parseArray(row.required_skills),
    preferredSkills: parseArray(row.preferred_skills),
    rawText: String(row.raw_text ?? ""),
    jdStatus: (toText(row.jd_status) ?? "missing") as JdStatus,
    jdSource: toText(row.jd_source) as JdSource | null,
    jdFetchedAt: toText(row.jd_fetched_at),
    jdCharCount: Number(row.jd_char_count ?? 0),
    jdError: toText(row.jd_error),
    jdPdfPath: toText(row.jd_pdf_path),
    firstSeenAt: String(row.first_seen_at ?? ""),
    lastSeenAt: String(row.last_seen_at ?? ""),
  };
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM app_meta WHERE key = ?").get(key) as
    | DbRow
    | undefined;
  return row ? toText(row.value) : null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export function getResume(): ResumeProfile | null {
  const row = getDb().prepare("SELECT * FROM resume WHERE id = 1").get() as
    | DbRow
    | undefined;
  if (!row) return null;
  return {
    fileName: String(row.file_name ?? ""),
    rawText: String(row.raw_text ?? ""),
    name: toText(row.name),
    email: toText(row.email),
    phone: toText(row.phone),
    degree: toText(row.degree),
    branch: toText(row.branch),
    cgpa: toNumber(row.cgpa),
    graduationYear: toNumber(row.graduation_year),
    education: parseEducation(row.education),
    skills: parseArray(row.skills),
    targetRoles: parseArray(row.target_roles),
    experienceMonths: Number(row.experience_months ?? 0),
    projects: parseArray(row.projects),
    certifications: parseArray(row.certifications),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function saveResume(profile: ResumeProfile): void {
  getDb()
    .prepare(
      `INSERT INTO resume (
        id, file_name, raw_text, name, email, phone, degree, branch, cgpa,
        graduation_year, education, skills, target_roles, experience_months, projects,
        certifications, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        raw_text = excluded.raw_text,
        name = excluded.name,
        email = excluded.email,
        phone = excluded.phone,
        degree = excluded.degree,
        branch = excluded.branch,
        cgpa = excluded.cgpa,
        graduation_year = excluded.graduation_year,
        education = excluded.education,
        skills = excluded.skills,
        target_roles = excluded.target_roles,
        experience_months = excluded.experience_months,
        projects = excluded.projects,
        certifications = excluded.certifications,
        updated_at = excluded.updated_at`,
    )
    .run(
      profile.fileName,
      profile.rawText,
      profile.name,
      profile.email,
      profile.phone,
      profile.degree,
      profile.branch,
      profile.cgpa,
      profile.graduationYear,
      JSON.stringify(profile.education),
      JSON.stringify(profile.skills),
      JSON.stringify(profile.targetRoles),
      profile.experienceMonths,
      JSON.stringify(profile.projects),
      JSON.stringify(profile.certifications),
      profile.updatedAt,
    );
}

export function getJobByExternalId(externalId: string): JobRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM jobs WHERE external_id = ?")
    .get(externalId) as DbRow | undefined;
  return row ? rowToJob(row) : null;
}

export function getJobById(id: number): JobRecord | null {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | DbRow
    | undefined;
  return row ? rowToJob(row) : null;
}

export function listJobs(): JobRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM jobs ORDER BY last_seen_at DESC, id DESC")
    .all() as DbRow[];
  return rows.map(rowToJob);
}

export function countJobs(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM jobs").get() as
    | DbRow
    | undefined;
  return row ? Number(row.count) : 0;
}

export function upsertJobs(
  jobs: JobInput[],
): { inserted: number; updated: number } {
  const db = getDb();
  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  const insertStmt = db.prepare(
    `INSERT INTO jobs (
      external_id, title, company, location, job_type, ctc, stipend,
      eligible_branches, eligible_degrees, min_cgpa, graduation_years,
      deadline, description, apply_url, required_skills, preferred_skills,
      raw_text, jd_status, jd_source, jd_fetched_at, jd_char_count, jd_error,
      jd_pdf_path, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      job_type = excluded.job_type,
      ctc = excluded.ctc,
      stipend = excluded.stipend,
      eligible_branches = excluded.eligible_branches,
      eligible_degrees = excluded.eligible_degrees,
      min_cgpa = excluded.min_cgpa,
      graduation_years = excluded.graduation_years,
      deadline = excluded.deadline,
      description = excluded.description,
      apply_url = excluded.apply_url,
      required_skills = excluded.required_skills,
      preferred_skills = excluded.preferred_skills,
      raw_text = excluded.raw_text,
      jd_status = excluded.jd_status,
      jd_source = excluded.jd_source,
      jd_fetched_at = excluded.jd_fetched_at,
      jd_char_count = excluded.jd_char_count,
      jd_error = excluded.jd_error,
      jd_pdf_path = excluded.jd_pdf_path,
      last_seen_at = excluded.last_seen_at`,
  );

  db.exec("BEGIN");
  try {
    for (const job of jobs) {
      const existing = getJobByExternalId(job.externalId);
      if (existing) updated += 1;
      else inserted += 1;
      insertStmt.run(
        job.externalId,
        job.title,
        job.company,
        job.location,
        job.jobType,
        job.ctc,
        job.stipend,
        JSON.stringify(job.eligibleBranches),
        JSON.stringify(job.eligibleDegrees),
        job.minCgpa,
        JSON.stringify(job.graduationYears),
        job.deadline,
        job.description,
        job.applyUrl,
        JSON.stringify(job.requiredSkills),
        JSON.stringify(job.preferredSkills),
        job.rawText,
        job.jdStatus,
        job.jdSource,
        job.jdFetchedAt,
        job.jdCharCount,
        job.jdError,
        job.jdPdfPath,
        now,
        now,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { inserted, updated };
}

export function saveJobExtraction(
  jobId: number,
  data: {
    description: string;
    jdStatus: JdStatus;
    jdSource: JdSource;
    jdFetchedAt: string;
    jdCharCount: number;
    jdError: string | null;
    jdPdfPath: string | null;
  },
): void {
  getDb()
    .prepare(
      `UPDATE jobs
       SET description = ?, jd_status = ?, jd_source = ?, jd_fetched_at = ?,
           jd_char_count = ?, jd_error = ?, jd_pdf_path = ?
       WHERE id = ?`,
    )
    .run(
      data.description,
      data.jdStatus,
      data.jdSource,
      data.jdFetchedAt,
      data.jdCharCount,
      data.jdError,
      data.jdPdfPath,
      jobId,
    );
}

export function saveScore(
  jobId: number,
  resumeUpdatedAt: string | null,
  breakdown: ScoreBreakdown,
): void {
  getDb()
    .prepare(
      `INSERT INTO scores (job_id, resume_updated_at, total, chance, breakdown, computed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(job_id) DO UPDATE SET
         resume_updated_at = excluded.resume_updated_at,
         total = excluded.total,
         chance = excluded.chance,
         breakdown = excluded.breakdown,
         computed_at = excluded.computed_at`,
    )
    .run(
      jobId,
      resumeUpdatedAt,
      breakdown.total,
      breakdown.chance,
      JSON.stringify(breakdown),
      new Date().toISOString(),
    );
}

export function getScore(jobId: number): ScoreBreakdown | null {
  const row = getDb().prepare("SELECT breakdown FROM scores WHERE job_id = ?").get(jobId) as
    | DbRow
    | undefined;
  if (!row || typeof row.breakdown !== "string") return null;
  try {
    return JSON.parse(row.breakdown) as ScoreBreakdown;
  } catch {
    return null;
  }
}

export function listScoredJobs(): ScoredJob[] {
  const jobs = listJobs();
  const scoreMap = readScoreMap();
  return jobs.map((job) => ({ ...job, score: scoreMap.get(job.id) ?? null }));
}

function readScoreMap(): Map<number, ScoreBreakdown> {
  const scoreRows = getDb()
    .prepare("SELECT job_id, breakdown FROM scores")
    .all() as DbRow[];
  const scoreMap = new Map<number, ScoreBreakdown>();
  for (const row of scoreRows) {
    if (typeof row.breakdown !== "string") continue;
    try {
      scoreMap.set(Number(row.job_id), JSON.parse(row.breakdown) as ScoreBreakdown);
    } catch {
      // ignore malformed
    }
  }
  return scoreMap;
}

/**
 * Dashboard list projection: only the columns the job cards actually render.
 * Avoids loading `description` / `raw_text` (the bulk of the job payload).
 */
export function listScoredJobSummaries(): JobSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT id, title, company, location, job_type, ctc, stipend, deadline,
              required_skills
       FROM jobs
       ORDER BY last_seen_at DESC, id DESC`,
    )
    .all() as DbRow[];
  const scoreMap = readScoreMap();
  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title ?? ""),
    company: String(row.company ?? ""),
    location: toText(row.location),
    jobType: toText(row.job_type),
    ctc: toText(row.ctc),
    stipend: toText(row.stipend),
    deadline: toText(row.deadline),
    requiredSkills: parseArray(row.required_skills),
    score: scoreMap.get(Number(row.id)) ?? null,
  }));
}

/**
 * Lower-cased search haystack per job id, including the full description.
 * Read server-side only — never sent to the client.
 */
export function getJobSearchIndex(): Map<number, string> {
  const rows = getDb()
    .prepare(
      `SELECT id, title || ' ' || company || ' ' || COALESCE(location, '') || ' ' ||
              required_skills || ' ' || COALESCE(description, '') || ' ' || raw_text AS haystack
       FROM jobs`,
    )
    .all() as DbRow[];
  const index = new Map<number, string>();
  for (const row of rows) {
    index.set(Number(row.id), String(row.haystack ?? "").toLowerCase());
  }
  return index;
}

export function clearScores(): void {
  getDb().exec("DELETE FROM scores");
}

export function startScrapeRun(): number {
  const result = getDb()
    .prepare(
      "INSERT INTO scrape_runs (started_at, status) VALUES (?, 'running')",
    )
    .run(new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function finishScrapeRun(
  id: number,
  data: {
    status: "success" | "error";
    jobsFound: number;
    jobsNew: number;
    jobsUpdated: number;
    error?: string | null;
  },
): void {
  const finishedAt = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE scrape_runs
       SET finished_at = ?, status = ?, jobs_found = ?, jobs_new = ?, jobs_updated = ?, error = ?
       WHERE id = ?`,
    )
    .run(
      finishedAt,
      data.status,
      data.jobsFound,
      data.jobsNew,
      data.jobsUpdated,
      data.error ?? null,
      id,
    );
  if (data.status === "success") {
    setMeta("last_success_at", finishedAt);
  }
}

function rowToRun(row: DbRow): ScrapeRun {
  return {
    id: Number(row.id),
    startedAt: String(row.started_at ?? ""),
    finishedAt: toText(row.finished_at),
    status: String(row.status ?? "") as ScrapeRun["status"],
    jobsFound: Number(row.jobs_found ?? 0),
    jobsNew: Number(row.jobs_new ?? 0),
    jobsUpdated: Number(row.jobs_updated ?? 0),
    error: toText(row.error),
  };
}

export function getLastRun(): ScrapeRun | null {
  const row = getDb()
    .prepare("SELECT * FROM scrape_runs ORDER BY id DESC LIMIT 1")
    .get() as DbRow | undefined;
  return row ? rowToRun(row) : null;
}

export function getRecentRuns(limit = 10): ScrapeRun[] {
  const rows = getDb()
    .prepare("SELECT * FROM scrape_runs ORDER BY id DESC LIMIT ?")
    .all(limit) as DbRow[];
  return rows.map(rowToRun);
}

export function getLastSuccessAt(): string | null {
  const meta = getMeta("last_success_at");
  if (meta) return meta;
  const row = getDb()
    .prepare(
      "SELECT finished_at FROM scrape_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1",
    )
    .get() as DbRow | undefined;
  return row ? toText(row.finished_at) : null;
}
