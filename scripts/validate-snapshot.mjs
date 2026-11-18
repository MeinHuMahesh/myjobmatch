import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "public", "data", "jobs.json");

if (!fs.existsSync(file)) {
  throw new Error(`Missing snapshot: ${file}`);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const jobs = Array.isArray(data.jobs) ? data.jobs : [];

if (!data.generatedAt || Number.isNaN(Date.parse(data.generatedAt))) {
  throw new Error("Snapshot has an invalid generatedAt timestamp.");
}
if (jobs.length < 10) {
  throw new Error(`Snapshot has only ${jobs.length} jobs; expected at least 10.`);
}

const ids = new Set();
for (const job of jobs) {
  if (!Number.isInteger(job.id) || ids.has(job.id)) {
    throw new Error(`Snapshot contains a missing or duplicate job id: ${job.id}`);
  }
  ids.add(job.id);
  if (!job.externalId || !job.title) {
    throw new Error(`Snapshot job ${job.id} is missing externalId or title.`);
  }
}

console.log(`Snapshot OK: ${jobs.length} jobs, generated ${data.generatedAt}.`);
