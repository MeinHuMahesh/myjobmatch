#!/usr/bin/env node
/**
 * Lighthouse-style performance probe for the JobMatch dashboard.
 *
 * Uses Playwright (already a project dependency) with Chrome's installed
 * channel, mobile emulation and 4x CPU throttling to approximate Lighthouse
 * mobile. Reports FCP, LCP, CLS, TBT and the JS bytes shipped.
 *
 * IMPORTANT: measure a production build, never `next dev`.
 *
 *   npm run build && npm start
 *   npm run perf -- http://localhost:3000/
 */
import { chromium } from "playwright";

const TARGET = process.argv[2] ?? "http://localhost:3000/";
const RUNS = Number(process.argv[3] ?? "3");
const THROTTLE = Number(process.argv[4] ?? "4");
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

async function measure(browser) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: MOBILE_UA,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

  await page.addInitScript(() => {
    const store = { long: [], cls: 0 };
    window.__perf = store;

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          store.long.push({
            dur: Math.round(entry.duration),
            start: Math.round(entry.startTime),
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      /* not supported */
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) store.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      /* not supported */
    }
  });

  let jsBytes = 0;
  let jsRequests = 0;
  let documentBytes = 0;

  page.on("response", async (response) => {
    try {
      const body = await response.body();
      const type = response.request().resourceType();
      if (type === "script") {
        jsBytes += body.length;
        jsRequests += 1;
      } else if (type === "document") {
        documentBytes += body.length;
      }
    } catch {
      /* body unavailable */
    }
  });

  await page.goto(TARGET, { waitUntil: "load" });
  await page.waitForTimeout(6000);

  const metrics = await page.evaluate(() => {
    const perf = window.__perf;
    const paint = performance.getEntriesByType("paint");
    const fcp = paint.find((entry) => entry.name === "first-contentful-paint");
    return {
      fcp: fcp ? Math.round(fcp.startTime) : 0,
      cls: perf.cls,
      long: perf.long,
    };
  });

  const lcp = await page.evaluate(
    () =>
      new Promise((resolve) => {
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) resolve(Math.round(entries[entries.length - 1].startTime));
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          resolve(0);
        }
        setTimeout(() => resolve(0), 500);
      }),
  );

  await context.close();

  const tbt = metrics.long.reduce((sum, task) => sum + Math.max(0, task.dur - 50), 0);
  return {
    fcp: metrics.fcp,
    lcp,
    cls: metrics.cls,
    tbt,
    longTasks: [...metrics.long].sort((a, b) => b.dur - a.dur).slice(0, 5),
    jsBytes,
    jsRequests,
    documentBytes,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main() {
  console.log(
    `Probing ${TARGET} (${RUNS} runs, mobile emulation @ ${THROTTLE}x CPU throttle)\n`,
  );

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    console.warn("Installed Chrome not found — falling back to bundled Chromium.");
    browser = await chromium.launch({ headless: true });
  }

  const results = [];
  for (let run = 1; run <= RUNS; run += 1) {
    const result = await measure(browser);
    results.push(result);
    console.log(
      `run ${run}: FCP ${result.fcp}ms · LCP ${result.lcp}ms · ` +
        `CLS ${result.cls.toFixed(4)} · TBT ${result.tbt}ms · JS ${(result.jsBytes / 1024).toFixed(1)}KB`,
    );
  }
  await browser.close();

  const avg = (pick) => average(results.map(pick));

  console.log("\n-- average -------------------------------");
  console.log(`  FCP   ${Math.round(avg((r) => r.fcp))} ms`);
  console.log(`  LCP   ${Math.round(avg((r) => r.lcp))} ms`);
  console.log(`  CLS   ${avg((r) => r.cls).toFixed(4)}`);
  console.log(`  TBT   ${Math.round(avg((r) => r.tbt))} ms`);
  console.log(
    `  JS    ${(avg((r) => r.jsBytes) / 1024).toFixed(1)} KB across ${results[0].jsRequests} requests`,
  );
  console.log(`  HTML  ${(avg((r) => r.documentBytes) / 1024).toFixed(1)} KB`);

  console.log("\n  longest tasks (run 1):");
  for (const task of results[0].longTasks) {
    console.log(`    ${task.dur}ms @${task.start}ms`);
  }

  if (avg((r) => r.jsBytes) > 1_500_000) {
    console.log(
      "\n  ! Over 1.5 MB of JS - are you measuring `next dev`? Audits must run against `next build && next start`.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
