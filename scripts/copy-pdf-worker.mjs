import fs from "node:fs";
import path from "node:path";

const source = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const targetDir = path.join(process.cwd(), "public");
const target = path.join(targetDir, "pdf.worker.min.mjs");

if (!fs.existsSync(source)) {
  throw new Error(`PDF worker not found at ${source}. Run npm install first.`);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log("Copied pdf.js worker to public/pdf.worker.min.mjs");
