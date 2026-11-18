import fs from "node:fs";
import path from "node:path";
import type { Frame } from "playwright";
import { config } from "../src/lib/config";
import { launchBrowser } from "../src/lib/scraper";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function dumpTables(frame: Frame, label: string): Promise<void> {
  const tables = frame.locator("table");
  const tableCount = await tables.count().catch(() => 0);
  console.log(`\n[${label}] Tables: ${tableCount}`);
  for (let t = 0; t < Math.min(tableCount, 20); t += 1) {
    const table = tables.nth(t);
    const rows = table.locator("tr");
    const rowCount = await rows.count().catch(() => 0);
    if (rowCount === 0) continue;
    const headerText = await rows
      .first()
      .innerText()
      .catch(() => "");
    const sample = [];
    for (let r = 0; r < Math.min(rowCount, 3); r += 1) {
      const text = await rows
        .nth(r)
        .innerText()
        .catch(() => "");
      sample.push(text.replace(/\s+/g, " ").slice(0, 220));
    }
    console.log(`  - Table ${t}: rows=${rowCount}`);
    if (headerText.trim()) {
      console.log(`    header: ${headerText.replace(/\s+/g, " ").slice(0, 220)}`);
    }
    sample.forEach((text, index) => console.log(`    row ${index}: ${text}`));
  }
}

async function dumpControls(frame: Frame): Promise<void> {
  const controls = frame.locator(
    'button, a, input, select, textarea, [role="button"], [role="link"], [role="textbox"]',
  );
  const count = await controls.count().catch(() => 0);
  console.log(`\n[controls] found ${count} interactive elements`);
  let printed = 0;
  for (let i = 0; i < count && printed < 80; i += 1) {
    const el = controls.nth(i);
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    const [tag, type, name, id, aria, title, text, value] = await Promise.all([
      el.evaluate((node) => node.tagName.toLowerCase()).catch(() => ""),
      el.getAttribute("type").catch(() => null),
      el.getAttribute("name").catch(() => null),
      el.getAttribute("id").catch(() => null),
      el.getAttribute("aria-label").catch(() => null),
      el.getAttribute("title").catch(() => null),
      el.innerText().catch(() => ""),
      el.getAttribute("value").catch(() => null),
    ]);
    const descriptor = [aria, title, text?.replace(/\s+/g, " ").slice(0, 60), value]
      .filter(Boolean)
      .join(" | ");
    if (!descriptor) continue;
    console.log(
      `  <${tag}${type ? ` type=${type}` : ""}${name ? ` name=${name}` : ""}${
        id ? ` id=${id}` : ""
      }> ${descriptor.slice(0, 140)}`,
    );
    printed += 1;
  }
}

async function clickStart(frame: Frame): Promise<boolean> {
  const candidates = frame.locator(
    'button, a, [ct="B"], .lsButton, [role="button"], input[type="submit"], input[type="button"]',
  );
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const el = candidates.nth(i);
    const [aria, title, text, value] = await Promise.all([
      el.getAttribute("aria-label").catch(() => null),
      el.getAttribute("title").catch(() => null),
      el.innerText().catch(() => ""),
      el.getAttribute("value").catch(() => null),
    ]);
    const combined = [aria, title, text, value].filter(Boolean).join(" ").trim();
    if (!/^start$/i.test(combined) && !/\bstart\b/i.test(combined)) continue;
    if (/next action|restart/i.test(combined)) continue;
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    console.log(`\nClicking Start control: "${combined}"`);
    await el.click({ timeout: 8000 }).catch(() => undefined);
    await delay(4000);
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  console.log(`Inspecting ${config.portalUrl} (headless: ${config.headless})`);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "en-IN",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(config.portalUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
    await delay(4000);

    const frames = page.frames();
    console.log(`\nDiscovered ${frames.length} frame(s).`);
    for (const [index, frame] of frames.entries()) {
      console.log(`\n===== Frame ${index}: ${frame.url()} =====`);
      await dumpControls(frame);
      await dumpTables(frame, `frame ${index} before Start`);
    }

    const frame = frames[frames.length - 1] ?? page.mainFrame();
    const clicked = await clickStart(frame);
    if (clicked) {
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
      await delay(3000);
      for (const [index, f] of page.frames().entries()) {
        console.log(`\n===== Frame ${index} AFTER Start =====`);
        await dumpTables(f, `frame ${index} after Start`);
      }
    }

    fs.mkdirSync(config.rawDir, { recursive: true });
    const snapshotPath = path.join(config.rawDir, `inspect-${Date.now()}.html`);
    fs.writeFileSync(snapshotPath, await page.content(), "utf8");
    console.log(`\nSaved full HTML snapshot to:\n  ${snapshotPath}`);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("\nInspection failed:", error);
  process.exitCode = 1;
});
