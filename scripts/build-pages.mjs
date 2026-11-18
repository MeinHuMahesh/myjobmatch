import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const apiDir = resolve(root, "src/app/api");
const backupDir = resolve(root, ".api-backup");

if (existsSync(backupDir)) {
  console.error("Remove the existing .api-backup directory before building.");
  process.exit(1);
}

const moved = existsSync(apiDir);
if (moved) renameSync(apiDir, backupDir);
rmSync(resolve(root, ".next"), { recursive: true, force: true });

const basePath = process.env.PAGES_BASE_PATH || "/myjobmatch";
const env = {
  ...process.env,
  PAGES_EXPORT: "1",
  PAGES_BASE_PATH: basePath,
  NEXT_PUBLIC_PAGES_BASE_PATH: basePath,
  NEXT_PUBLIC_STATIC_EXPORT: "1",
};

let status = 1;
try {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  status = result.status ?? 1;
} finally {
  if (moved && existsSync(backupDir)) renameSync(backupDir, apiDir);
}

process.exit(status);
