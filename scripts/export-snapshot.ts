import fs from "node:fs";
import path from "node:path";
import { listJobs } from "../src/lib/db";
import type { ScoredJob } from "../src/lib/types";

const outDir = path.join(process.cwd(), "public", "data");
fs.mkdirSync(outDir, { recursive: true });

const jobs: ScoredJob[] = listJobs().map((job) => ({
  ...job,
  score: null,
  jdPdfPath: null,
}));

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
