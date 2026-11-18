import fs from "node:fs";
import path from "node:path";
import { listJobs } from "../src/lib/db";
import type { ScoredJob } from "../src/lib/types";

const outDir = path.join(process.cwd(), "public", "data");
const snapshotPath = path.join(outDir, "jobs.json");
fs.mkdirSync(outDir, { recursive: true });

let previousJobs: Partial<ScoredJob>[] = [];
if (fs.existsSync(snapshotPath)) {
  try {
    const previous = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as {
      jobs?: Partial<ScoredJob>[];
    };
    if (Array.isArray(previous.jobs)) previousJobs = previous.jobs;
  } catch {
    previousJobs = [];
  }
}
const previousByExternalId = new Map(
  previousJobs
    .filter((job) => job.externalId)
    .map((job) => [job.externalId as string, job] as const),
);

const jobs: ScoredJob[] = listJobs().map((job) => {
  const merged: ScoredJob = { ...job, score: null, jdPdfPath: null };
  const previous = previousByExternalId.get(job.externalId);

  if (previous && (!merged.description || merged.description.length < 500)) {
    merged.description = previous.description ?? merged.description;
    merged.requiredSkills = previous.requiredSkills ?? merged.requiredSkills;
    merged.preferredSkills = previous.preferredSkills ?? merged.preferredSkills;
    merged.rawText = previous.rawText ?? merged.rawText;
    merged.jdStatus = previous.jdStatus ?? merged.jdStatus;
    merged.jdSource = previous.jdSource ?? merged.jdSource;
    merged.jdFetchedAt = previous.jdFetchedAt ?? merged.jdFetchedAt;
    merged.jdCharCount = previous.jdCharCount ?? merged.jdCharCount;
    merged.jdError = previous.jdError ?? merged.jdError;
  }

  if (previous?.firstSeenAt && (!merged.firstSeenAt || previous.firstSeenAt < merged.firstSeenAt)) {
    merged.firstSeenAt = previous.firstSeenAt;
  }

  return merged;
});

const generatedAt = new Date().toISOString();

fs.writeFileSync(
  path.join(outDir, "jobs.json"),
  `${JSON.stringify({ generatedAt, jobs }, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outDir, "meta.json"),
  `${JSON.stringify(
    {
      generatedAt,
      count: jobs.length,
      source: "IIT Bombay placement portal",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Wrote snapshot with ${jobs.length} jobs (generated ${generatedAt}).`);
