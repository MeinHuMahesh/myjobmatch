import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Frame, type Page } from "playwright";
import { config } from "./config";
import { extractDocument } from "./parseResume";
import type { DetailProgress, DetailStats, JobRecord, RawJobRow } from "./types";

const SKIP_LINK_PATTERNS = [
  /^user help\.?$/i,
  /click here to view job vacancies/i,
  /return to search/i,
  /^apply$/i,
  /^start$/i,
  /^reset$/i,
];

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isDate(value: string): boolean {
  return /^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}$/.test(value.trim());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function launchBrowser(): Promise<Browser> {
  const channel = process.env.PW_CHANNEL ?? "chrome";
  try {
    return await chromium.launch({
      headless: config.headless,
      channel,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (error) {
    try {
      return await chromium.launch({ headless: config.headless });
    } catch {
      throw new Error(
        `Could not launch a browser. Install one with "npx playwright install chromium", ` +
          `or set PW_CHANNEL=msedge / PW_CHANNEL=chrome. Original error: ${(error as Error).message}`,
      );
    }
  }
}

async function findJobFrame(page: Page): Promise<Frame> {
  for (const frame of page.frames()) {
    const count = await frame.locator('a[ct="LN"]').count().catch(() => 0);
    if (count > 0) return frame;
  }
  return page.mainFrame();
}

async function waitForJobRows(frame: Frame): Promise<void> {
  await frame
    .waitForFunction(
      () => {
        const links = Array.from(document.querySelectorAll('a[ct="LN"]'));
        return links.some((link) => {
          const row = link.closest("tr");
          return row && /EXT\s?\d+\s*\/\s*\d{4}/i.test(row.textContent ?? "");
        });
      },
      { timeout: 30000 },
    )
    .catch(() => undefined);
}

async function clickStart(page: Page, frame: Frame): Promise<boolean> {
  const start = frame.locator('[ct="B"]', { hasText: /^\s*Start\s*$/ }).first();
  const hasStart = (await start.count().catch(() => 0)) > 0;
  if (!hasStart) return false;
  await start.click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
  await waitForJobRows(frame);
  await sleep(config.throttleMs);
  return true;
}

async function extractJobRows(frame: Frame): Promise<RawJobRow[]> {
  const links = frame.locator('a[ct="LN"]');
  const count = await links.count().catch(() => 0);
  const rows: RawJobRow[] = [];

  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const text = clean(await link.innerText().catch(() => ""));
    if (!text) continue;
    if (SKIP_LINK_PATTERNS.some((pattern) => pattern.test(text))) continue;

    const row = link.locator("xpath=ancestor::tr[1]");
    if ((await row.count().catch(() => 0)) === 0) continue;
    const cells = (await row.locator("td").allInnerTexts().catch(() => [])).map(clean);
    const referenceCode = cells.find((cell) => /EXT\s?\d+\s*\/\s*\d{4}/i.test(cell));
    if (!referenceCode) continue;

    const dates = cells.filter(isDate);
    const startDate = dates[0] ?? "";
    const endDate = dates[1] ?? "";
    const isInstituteStaff = /^registrar$/i.test(text) || /^admin-/i.test(referenceCode);
    const category = isInstituteStaff ? "Institute Staff" : "Project Staff";

    rows.push({
      cells: {
        title: text,
        referenceCode,
        startDate,
        deadline: endDate,
        company: "IIT Bombay",
        location: "Mumbai",
        jobType: category,
        category,
      },
      rawText: [text, referenceCode, startDate, endDate].filter(Boolean).join(" | "),
    });
  }

  return rows;
}

function signature(rows: RawJobRow[]): string {
  return rows.map((row) => row.cells.referenceCode ?? row.rawText).join("|");
}

async function clickNext(frame: Frame, previous: string): Promise<boolean> {
  const candidates = frame.locator('[ct="B"], a[ct="LN"]');
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const el = candidates.nth(i);
    const label = clean(
      [
        await el.getAttribute("aria-label").catch(() => null),
        await el.getAttribute("title").catch(() => null),
        await el.innerText().catch(() => ""),
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (!label || /next\s+action/i.test(label)) continue;
    if (!/^(next|next page|next\s*›|›|»|>|more)$/i.test(label) && !/next page/i.test(label)) {
      continue;
    }
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    try {
      await el.click({ timeout: 5000 });
    } catch {
      continue;
    }
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await sleep(400);
      const rows = await extractJobRows(frame).catch(() => []);
      if (signature(rows) !== previous) return true;
    }
    return false;
  }
  return false;
}

function saveSnapshot(page: Page): string | null {
  try {
    fs.mkdirSync(config.rawDir, { recursive: true });
    const file = path.join(
      config.rawDir,
      `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.html`,
    );
    fs.writeFileSync(file, "", "utf8");
    void page
      .content()
      .then((html) => fs.writeFileSync(file, html, "utf8"))
      .catch(() => undefined);
    return file;
  } catch {
    return null;
  }
}

export interface ScrapeOptions {
  details?: boolean;
  refreshDetails?: boolean;
  existingJobs?: JobRecord[];
  onProgress?: (message: string) => void;
  onDetailProgress?: (
    done: number,
    total: number,
    progress: DetailProgress,
  ) => void;
}

export interface ScrapeResult {
  rows: RawJobRow[];
  details: DetailStats;
}

interface ListSession {
  context: BrowserContext;
  page: Page;
  frame: Frame;
}

function emptyDetailStats(): DetailStats {
  return { fetched: 0, reused: 0, failed: 0, ocrPages: 0 };
}

function asError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function existingKey(row: RawJobRow): string | null {
  const referenceCode = row.cells.referenceCode;
  return referenceCode ? referenceCode.trim().toLowerCase() : null;
}

function applyExistingDetail(row: RawJobRow, existing: JobRecord): void {
  row.detailText = existing.description ?? undefined;
  row.applyUrl = existing.applyUrl ?? undefined;
  row.jdStatus = existing.jdStatus;
  row.jdSource = existing.jdSource ?? undefined;
  row.jdFetchedAt = existing.jdFetchedAt ?? undefined;
  row.jdCharCount = existing.jdCharCount;
  row.jdError = existing.jdError ?? undefined;
  row.jdPdfPath = existing.jdPdfPath ?? undefined;
}

function shouldFetchDetail(
  row: RawJobRow,
  existing: JobRecord | undefined,
  refresh: boolean,
): boolean {
  if (!existing || refresh) return true;
  if (existing.jdStatus !== "ok" && existing.jdStatus !== "ocr") return true;
  if (!existing.description || existing.description.trim().length < 200) return true;
  if (!existing.applyUrl || !existing.jdFetchedAt) return true;
  if (row.cells.deadline && existing.deadline && row.cells.deadline !== existing.deadline) {
    return true;
  }
  if (config.jdRefreshHours <= 0) return false;
  const fetchedAt = Date.parse(existing.jdFetchedAt);
  if (!Number.isFinite(fetchedAt)) return true;
  return Date.now() - fetchedAt >= config.jdRefreshHours * 60 * 60 * 1000;
}

function cleanDetailText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function ensureListVisible(page: Page, frame: Frame): Promise<void> {
  let count = await frame.locator('a[ct="LN"]').count().catch(() => 0);
  if (count > 0) return;
  const back = frame
    .locator('[ct="B"]', { hasText: /^\s*Return to Search\s*$/ })
    .first();
  if ((await back.count().catch(() => 0)) > 0) {
    await back.click({ timeout: 10000 }).catch(() => undefined);
    await sleep(1500);
    count = await frame.locator('a[ct="LN"]').count().catch(() => 0);
    if (count > 0) return;
  }
  await clickStart(page, frame);
}

async function findJobLink(frame: Frame, referenceCode: string) {
  const links = frame.locator('a[ct="LN"]');
  const count = await links.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const text = clean(await link.innerText().catch(() => ""));
    if (!text || SKIP_LINK_PATTERNS.some((pattern) => pattern.test(text))) continue;
    const row = link.locator("xpath=ancestor::tr[1]");
    if ((await row.count().catch(() => 0)) === 0) continue;
    const cells = (await row.locator("td").allInnerTexts().catch(() => [])).map(clean);
    if (cells.some((cell) => cell.includes(referenceCode))) return link;
  }
  return null;
}

function activeApplyButton(frame: Frame) {
  const active = frame
    .locator('[ct="B"].lsButton--active', { hasText: /^\s*Apply\s*$/ })
    .first();
  return active;
}

async function captureDetail(
  context: BrowserContext,
  page: Page,
  frame: Frame,
  row: RawJobRow,
  log: (message: string) => void,
): Promise<void> {
  const referenceCode = row.cells.referenceCode;
  if (!referenceCode) {
    row.jdStatus = "failed";
    row.jdError = "Missing reference code";
    return;
  }

  const titleLink = await findJobLink(frame, referenceCode);
  if (!titleLink) {
    row.jdStatus = "failed";
    row.jdError = "Could not find row in listing";
    log(`Could not find row for "${row.cells.title}"`);
    return;
  }

  await titleLink.click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(1200);

  const apply = activeApplyButton(frame);
  const applyDeadline = Date.now() + 10000;
  while (Date.now() < applyDeadline) {
    if ((await apply.count().catch(() => 0)) > 0 && (await apply.isVisible().catch(() => false))) {
      break;
    }
    await page.waitForTimeout(300);
  }
  if ((await apply.count().catch(() => 0)) === 0) {
    row.jdStatus = "failed";
    row.jdError = "No Apply button";
    log(`No Apply button for "${row.cells.title}"`);
    return;
  }
  if (!(await apply.isVisible().catch(() => false))) {
    row.jdStatus = "failed";
    row.jdError = "Apply button not visible";
    log(`Apply button not visible for "${row.cells.title}"`);
    return;
  }

  await apply.click({ timeout: 10000 }).catch(() => undefined);

  let detailPage: Page | null = null;
  const pageDeadline = Date.now() + 30000;
  while (Date.now() < pageDeadline) {
    detailPage =
      context.pages().find((candidate) => /hrrcf_a_posting_apply/i.test(candidate.url())) ?? null;
    if (detailPage) break;
    if (/hrrcf_a_posting_apply/i.test(page.url())) {
      detailPage = page;
      break;
    }
    await page.waitForTimeout(400);
  }

  try {
    if (!detailPage) {
      row.jdStatus = "failed";
      row.jdError = "Could not open JD page";
      log(`Could not open the JD page for "${row.cells.title}"`);
      return;
    }
    await detailPage
      .waitForLoadState("domcontentloaded", { timeout: 20000 })
      .catch(() => undefined);

    let pdfUrl: string | null = null;
    const iframe = detailPage.locator("#WD2D-ph iframe").first();
    const srcDeadline = Date.now() + 20000;
    while (Date.now() < srcDeadline) {
      const src = await iframe.getAttribute("src", { timeout: 1000 }).catch(() => null);
      if (src && /application\.do/i.test(src)) {
        pdfUrl = new URL(src, detailPage.url()).toString();
        break;
      }
      await detailPage.waitForTimeout(300);
    }

    if (!pdfUrl) {
      const jdFrame = detailPage
        .frames()
        .find((candidate) => /hrrcf_wd_dovru|application\.do/i.test(candidate.url()));
      if (jdFrame) pdfUrl = jdFrame.url();
    }

    if (!pdfUrl) {
      const fallbackIframe = detailPage.locator("#WD2D-ph iframe, iframe").first();
      const src = await fallbackIframe
        .getAttribute("src", { timeout: 5000 })
        .catch(() => null);
      if (src) pdfUrl = new URL(src, detailPage.url()).toString();
    }

    if (!pdfUrl) {
      row.jdStatus = "failed";
      row.jdError = "Could not find JD document";
      log(`Could not find the JD document for "${row.cells.title}"`);
      return;
    }

    const response = await context.request.get(pdfUrl, {
      headers: { Accept: "application/pdf", Referer: detailPage.url() },
      timeout: 60000,
    });
    if (!response.ok()) {
      throw new Error(`JD download failed with HTTP ${response.status()}`);
    }
    const body = await response.body();
    if (body.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error("JD response was not a PDF");
    }

    const extracted = await extractDocument("job-description.pdf", body, {
      ocr: config.ocrEnabled,
    });
    const cleaned = cleanDetailText(extracted.text);
    if (!cleaned) {
      row.jdStatus = "empty";
      row.jdError = "No text found in JD";
      log(`JD for "${row.cells.title}" was empty`);
      return;
    }

    row.detailText = cleaned;
    row.applyUrl = detailPage.url();
    row.jdStatus = extracted.source === "native" ? "ok" : "ocr";
    row.jdSource = extracted.source;
    row.jdOcrPages = extracted.ocrPages;
    row.jdFetchedAt = new Date().toISOString();
    row.jdCharCount = cleaned.length;
    row.jdError = undefined;

    if (config.storePdfs) {
      try {
        fs.mkdirSync(config.pdfDir, { recursive: true });
        const safeReference = referenceCode.replace(/[^a-z0-9._-]+/gi, "_");
        const file = path.join(config.pdfDir, `${safeReference}.pdf`);
        fs.writeFileSync(file, body);
        row.jdPdfPath = path.relative(process.cwd(), file).replace(/\\/g, "/");
      } catch (error) {
        log(`Could not store JD PDF for "${row.cells.title}": ${asError(error)}`);
      }
    }

    const ocrNote = extracted.ocrPages.length
      ? `, OCR pages ${extracted.ocrPages.join(", ")}`
      : "";
    log(
      `Captured JD for "${row.cells.title}" (${cleaned.length} chars${ocrNote})`,
    );
  } finally {
    for (const openPage of context.pages()) {
      if (openPage !== page) await openPage.close().catch(() => undefined);
    }
  }
}

async function openListSession(browser: Browser): Promise<ListSession> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  });
  await context.route("**/hrrcf_a_applwizard**", (route) => route.abort());
  const page = await context.newPage();
  await page.goto(config.portalUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 20000 })
    .catch(() => undefined);
  await sleep(2000);

  let frame = await findJobFrame(page);
  const clicked = await clickStart(page, frame);
  if (clicked) frame = await findJobFrame(page);
  await waitForJobRows(frame);
  await sleep(config.throttleMs);
  return { context, page, frame };
}

async function captureOne(
  session: ListSession,
  row: RawJobRow,
  log: (message: string) => void,
): Promise<boolean> {
  const attempts = config.detailRetries + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const previousText = row.detailText;
    try {
      await captureDetail(session.context, session.page, session.frame, row, log);
      if (row.jdStatus === "ok" || row.jdStatus === "ocr") {
        await ensureListVisible(session.page, session.frame);
        session.frame = await findJobFrame(session.page);
        return true;
      }
      if (!row.detailText) row.detailText = previousText;
    } catch (error) {
      row.jdStatus = "failed";
      row.jdError = asError(error);
      log(
        `Could not capture details for "${row.cells.title}": ${asError(error)}`,
      );
    }

    if (attempt + 1 < attempts) {
      log(`Retrying JD capture for "${row.cells.title}"…`);
      await ensureListVisible(session.page, session.frame);
      session.frame = await findJobFrame(session.page);
      await sleep(1000);
    }
  }

  row.jdStatus = "failed";
  row.jdError = row.jdError ?? "JD capture failed";
  await ensureListVisible(session.page, session.frame);
  session.frame = await findJobFrame(session.page);
  return false;
}

async function captureDetailsSerial(
  session: ListSession,
  rows: RawJobRow[],
  log: (message: string) => void,
  onRow: (row: RawJobRow, ok: boolean) => void,
): Promise<void> {
  for (const row of rows) {
    const ok = await captureOne(session, row, log);
    onRow(row, ok);
    await sleep(Math.max(150, Math.round(config.throttleMs / 2)));
  }
}

async function captureDetailsParallel(
  browser: Browser,
  rows: RawJobRow[],
  log: (message: string) => void,
  onRow: (row: RawJobRow, ok: boolean) => void,
): Promise<void> {
  const workerCount = Math.max(
    1,
    Math.min(config.detailConcurrency, rows.length),
  );
  let nextIndex = 0;

  const runWorker = async () => {
    let session: ListSession;
    try {
      session = await openListSession(browser);
    } catch (error) {
      log(`Could not start a detail worker: ${asError(error)}`);
      return;
    }

    try {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= rows.length) break;
        const row = rows[index];
        const ok = await captureOne(session, row, log);
        onRow(row, ok);
        await sleep(Math.max(150, Math.round(config.throttleMs / 2)));
      }
    } finally {
      await session.context.close().catch(() => undefined);
    }
  };

  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );
}

export async function scrapeJobs(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const log = options.onProgress ?? (() => undefined);
  const browser = await launchBrowser();
  const collected: RawJobRow[] = [];
  const seen = new Set<string>();
  const details = emptyDetailStats();
  const existingByReference = new Map<string, JobRecord>();
  for (const job of options.existingJobs ?? []) {
    const reference = job.externalId.replace(/^iitb:/i, "").toLowerCase();
    existingByReference.set(reference, job);
  }
  const refreshDetails = options.refreshDetails ?? config.refreshDetails;

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "en-IN",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    });
    await context.route("**/hrrcf_a_applwizard**", (route) => route.abort());
    const page = await context.newPage();

    if (config.captureNetwork) {
      fs.mkdirSync(config.rawDir, { recursive: true });
      const networkFile = path.join(
        config.rawDir,
        `network-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`,
      );
      page.on("response", async (response) => {
        const type = response.request().resourceType();
        if (type !== "xhr" && type !== "fetch") return;
        try {
          const body = await response.text();
          fs.appendFileSync(
            networkFile,
            `${JSON.stringify({
              url: response.url(),
              status: response.status(),
              body: body.slice(0, 50000),
            })}\n`,
          );
        } catch {
          // ignore
        }
      });
    }

    log(`Opening ${config.portalUrl}`);
    await page.goto(config.portalUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
    await sleep(3000);

    let frame = await findJobFrame(page);
    const clicked = await clickStart(page, frame);
    if (clicked) {
      log("Clicked Start; loading job postings…");
      frame = await findJobFrame(page);
    }
    await waitForJobRows(frame);
    await sleep(config.throttleMs);

    const fetchDetails = options.details ?? config.scrapeDetails;
    let pageIndex = 0;
    let previousSignature = "";
    while (pageIndex < config.maxPages) {
      const rows = await extractJobRows(frame);
      log(`Page ${pageIndex + 1}: found ${rows.length} jobs`);
      if (rows.length === 0) break;

      const pageRows: RawJobRow[] = [];
      for (const row of rows) {
        const id = row.cells.referenceCode ?? row.rawText;
        if (seen.has(id)) continue;
        seen.add(id);
        pageRows.push(row);
      }

      if (fetchDetails && pageRows.length > 0) {
        const candidates: RawJobRow[] = [];
        let reused = 0;
        for (const row of pageRows) {
          const key = existingKey(row);
          const existing = key ? existingByReference.get(key) : undefined;
          if (existing) applyExistingDetail(row, existing);
          if (shouldFetchDetail(row, existing, refreshDetails)) {
            candidates.push(row);
          } else {
            reused += 1;
          }
        }
        details.reused += reused;

        if (candidates.length === 0) {
          log(`All ${reused} job descriptions are already cached.`);
          options.onDetailProgress?.(0, 0, {
            fetched: 0,
            reused,
            failed: 0,
            ocrPages: 0,
            active: 0,
          });
        } else {
          log(
            `Fetching full descriptions for ${candidates.length} jobs` +
              `${reused ? ` (${reused} cached)` : ""}…`,
          );
          let done = 0;
          let fetched = 0;
          let failed = 0;
          let ocrPageCount = 0;

          const report = () =>
            options.onDetailProgress?.(done, candidates.length, {
              fetched,
              reused,
              failed,
              ocrPages: ocrPageCount,
              active: Math.max(0, candidates.length - done),
            });

          const onRow = (row: RawJobRow, ok: boolean) => {
            done += 1;
            if (ok) {
              fetched += 1;
              details.fetched += 1;
              ocrPageCount +=
                row.jdOcrPages?.length ?? (row.jdSource === "ocr" ? 1 : 0);
            } else {
              failed += 1;
              details.failed += 1;
            }
            report();
          };

          report();
          if (pageIndex === 0 && config.detailConcurrency > 1) {
            const attempted = new Set<RawJobRow>();
            await captureDetailsParallel(browser, candidates, log, (row, ok) => {
              attempted.add(row);
              onRow(row, ok);
            });
            const remaining = candidates.filter((row) => !attempted.has(row));
            if (remaining.length > 0) {
              const serialSession: ListSession = { context, page, frame };
              await captureDetailsSerial(serialSession, remaining, log, onRow);
              frame = serialSession.frame;
            }
          } else {
            const serialSession: ListSession = { context, page, frame };
            await captureDetailsSerial(serialSession, candidates, log, onRow);
            frame = serialSession.frame;
          }
          details.ocrPages += ocrPageCount;
        }
      }

      collected.push(...pageRows);

      const currentSignature = signature(rows);
      if (currentSignature === previousSignature) break;
      previousSignature = currentSignature;

      const advanced = await clickNext(frame, currentSignature);
      if (!advanced) break;
      pageIndex += 1;
      await sleep(config.throttleMs);
    }

    if (collected.length === 0) {
      const snapshot = saveSnapshot(page);
      throw new Error(
        `No job postings were found. The portal layout may have changed, or the Start search did not load.` +
          `${snapshot ? ` Snapshot saved to ${snapshot}.` : ""} Run "npm run inspect" to debug.`,
      );
    }

    return { rows: collected, details };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
