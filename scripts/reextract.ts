import fs from "node:fs";
import path from "node:path";
import { config } from "../src/lib/config";
import { listJobs, saveJobExtraction } from "../src/lib/db";
import { extractDocument } from "../src/lib/parseResume";
import { rescoreAll } from "../src/lib/scrape-service";

const args = new Set(process.argv.slice(2));
const useOcr = !args.has("--no-ocr");

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message}`);
}

function asError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const jobs = listJobs().filter((job) => job.jdPdfPath);
  if (jobs.length === 0) {
    log("No stored advert PDFs found under db/jd. Run a scrape first.");
    return;
  }

  log(`Re-extracting ${jobs.length} stored advert PDFs (OCR: ${useOcr ? "on" : "off"})…`);
  let updated = 0;
  let failed = 0;

  for (const job of jobs) {
    const pdfPath = path.isAbsolute(job.jdPdfPath!)
      ? job.jdPdfPath!
      : path.join(process.cwd(), job.jdPdfPath!);
    if (!fs.existsSync(pdfPath)) {
      failed += 1;
      log(`Missing PDF for "${job.title}": ${pdfPath}`);
      continue;
    }

    try {
      const extracted = await extractDocument(
        "job-description.pdf",
        fs.readFileSync(pdfPath),
        { ocr: useOcr },
      );
      const text = extracted.text.trim();
      saveJobExtraction(job.id, {
        description: text || (job.description ?? ""),
        jdStatus: text
          ? extracted.source === "native"
            ? "ok"
            : "ocr"
          : "empty",
        jdSource: extracted.source,
        jdFetchedAt: new Date().toISOString(),
        jdCharCount: text.length,
        jdError: text ? null : "No text found in JD",
        jdPdfPath: job.jdPdfPath,
      });
      updated += 1;
      const ocrNote = extracted.ocrPages.length
        ? `, OCR pages ${extracted.ocrPages.join(", ")}`
        : "";
      log(
        `Re-extracted "${job.title}" (${text.length} chars, ${extracted.source}${ocrNote})`,
      );
    } catch (error) {
      failed += 1;
      saveJobExtraction(job.id, {
        description: job.description ?? "",
        jdStatus: "failed",
        jdSource: job.jdSource ?? "native",
        jdFetchedAt: new Date().toISOString(),
        jdCharCount: job.jdCharCount,
        jdError: asError(error),
        jdPdfPath: job.jdPdfPath,
      });
      log(`Could not re-extract "${job.title}": ${asError(error)}`);
    }
  }

  const rescored = rescoreAll();
  log(
    `Done. Updated ${updated}, failed ${failed}, rescored ${rescored} jobs.`,
  );
}

main().catch((error) => {
  console.error("Re-extraction failed:", error);
  process.exitCode = 1;
});
