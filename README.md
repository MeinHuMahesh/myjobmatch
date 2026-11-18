# IIT Bombay Job Match

A local web app that fetches every live posting from IIT Bombay's
[Career Opportunities portal](https://ep.iitb.ac.in/jobsearch), scores each posting
against your resume, and shows how strong your chance is for each role.

Nothing is sent to a third party: scraping, resume parsing, and scoring all run on
your machine.

## Features

- **One-click fetch** of all current IIT Bombay staff and project-staff vacancies,
  including the **full job description** from each posting's public advert PDF.
- **Resume upload** (PDF or DOCX) with editable parsed profile (skills, degree,
  branch, CGPA, graduation year, experience, target roles) and an extracted
  education history that keeps each degree's specialization (e.g. B.Sc in IT).
- **Mobile-first UI** with a bottom tab bar, so you can browse comfortably from
  your phone on the same Wi-Fi network.
- **Explainable 0-100 score** built from skills, role similarity, and experience,
  plus eligibility checks (branch, degree, CGPA, batch, deadline).
- **Daily scheduler** bundled with the app (06:00 by default) and a manual
  "Fetch now" button that always overrides the interval.
- **Local SQLite database** (`db/jobs.db`) — no account, no API key, no cloud.

## Requirements

- Node.js 24+ (uses the built-in `node:sqlite` module).
- Google Chrome or Microsoft Edge installed (Playwright drives it).

## Getting started

```bash
npm install
npm run dev:all
```

Open <http://localhost:3000>, go to **Resume**, upload your CV, review the parsed
profile, then click **Fetch now** on the dashboard.

> `npm run dev` starts only the Next.js app. `npm run dev:all` also starts the
> background scheduler that refreshes jobs daily.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the web app (no scheduler). |
| `npm run dev:all` | Run the app **and** the daily scheduler. |
| `npm run dev:lan` | Run the app on your LAN (reachable from your phone). |
| `npm run dev:all:lan` | LAN app + scheduler. |
| `npm run build` | Production build. |
| `npm run start:all` | Run the built app with the scheduler. |
| `npm run start:lan` | Run the built app on your LAN. |
| `npm run start:all:lan` | LAN production app + scheduler. |
| `npm run scrape` | Fetch jobs once (skips if fetched within 24h). |
| `npm run scrape:force` | Fetch jobs now, ignoring the interval. |
| `npm run scrape -- --refresh-details` | Re-download and re-extract every advert PDF. |
| `npm run reextract` | Re-extract stored PDFs under `db/jd` (OCR optional with `--no-ocr`). |
| `npm run scheduler` | Run only the scheduler. |
| `npm run inspect` | Debug helper: opens the portal, clicks Start, prints what it sees. |
| `npm run perf` | Measure FCP/LCP/CLS/TBT of a running build (see [Performance](#performance)). |
| `npm run test` | Run the scoring unit tests. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript check. |

## Performance

> **Always audit a production build.** `next dev` ships ~3.6 MB of unminified JS
> plus dev-only instrumentation, which inflates Total Blocking Time roughly 4x.
> A Lighthouse run against `npm run dev` is not representative.

```bash
npm run build
npm start                 # or: npm run start:all
npm run perf              # defaults to http://localhost:3000/
npm run perf -- http://localhost:3000/ 5   # custom URL, 5 runs
```

`npm run perf` drives the installed Chrome with Playwright, emulates a mobile
device (393×852, DPR 2.625) at 4x CPU throttle, and reports FCP, LCP, CLS, TBT
and the JS bytes shipped, averaged over several runs.

What keeps the dashboard fast:

| Change | Why |
| --- | --- |
| Server-rendered first page (`INITIAL_PAGE_SIZE`) | No client fetch waterfall, layout (CLS) stays at 0. |
| `JobSummary` projection in `/api/jobs` | ~25 KB instead of ~160 KB — drops `description`/`rawText`, which the list never renders. |
| CSS `conic-gradient` score ring | Replaces per-card SVG nodes, which participate in layout. |
| `content-visibility: auto` on cards | Off-screen cards skip layout/paint. |
| `prefetch={false}` on job links | Avoids an RSC prefetch per card as you scroll. |
| Memoised cards + paused polling | The 15 s status poll no longer re-renders the list. |

Reference numbers on the bundled 26-job dataset (4x CPU, mobile):

| | dev server | production |
| --- | --- | --- |
| JS shipped | ~3.6 MB | ~480 KB |
| TBT | ~966 ms (1,510 ms in Lighthouse) | ~277 ms |
| CLS | 0.15–0.41 | 0.00 |
| FCP | 544 ms | ~600 ms |

## How the score works

| Component | Weight | Meaning |
| --- | --- | --- |
| Skills | 50% | Overlap between your skills and the posting's must/nice-to-have skills. |
| Role | 30% | Similarity between the job title and your target roles, skills, and projects. |
| Experience | 20% | Your months of experience vs. what the posting asks for. |

Eligibility checks (branch, degree, CGPA, graduation year, deadline) act as gates.
If any check fails, the total is capped at 25 and the chance is marked **Low**.
Otherwise: **High** ≥ 72, **Medium** ≥ 52, **Low** below 52.

## Configuration

Copy `.env.example` to `.env.local` and adjust as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORTAL_URL` | `https://ep.iitb.ac.in/jobsearch` | Source portal. |
| `SCRAPE_CRON` | `0 6 * * *` | Daily refresh time (cron syntax). |
| `SCRAPE_MIN_INTERVAL_HOURS` | `24` | Skip a scheduled run if the last success was more recent. |
| `HEADLESS` | `true` | Set `false` to watch the browser. |
| `SCRAPE_MAX_PAGES` | `50` | Pagination safety limit. |
| `SCRAPE_THROTTLE_MS` | `800` | Delay between page actions. |
| `SCRAPE_DETAILS` | `true` | Capture full job descriptions; cached JDs are reused. |
| `SCRAPE_REFRESH_DETAILS` | `false` | Ignore the JD cache and re-download every advert. |
| `SCRAPE_DETAIL_CONCURRENCY` | `3` | Parallel JD capture workers (1-5). |
| `SCRAPE_JD_REFRESH_HOURS` | `168` | Reuse a cached JD for this long; `0` = never expire. |
| `SCRAPE_STORE_PDFS` | `true` | Store advert PDFs under `db/jd` for re-extraction. |
| `OCR_ENABLED` | `true` | OCR fallback for scanned/low-quality advert pages. |
| `OCR_MIN_CHARS_PER_PAGE` | `40` | OCR a page when its native text is below this threshold. |
| `OCR_SCALE` | `2` | Screenshot scale used for OCR. |
| `JD_PDF_DIR` | `db/jd` | Stored advert PDF directory. |
| `OCR_CACHE_DIR` | `db/tesseract-cache` | Tesseract language cache. |
| `DATABASE_PATH` | `db/jobs.db` | SQLite file location. |
| `RAW_DIR` | `db/raw` | Debug snapshots / network captures. |
| `PW_CHANNEL` | `chrome` | Playwright browser channel (`chrome`, `msedge`, or empty for bundled Chromium). |
| `SCRAPE_CAPTURE_NETWORK` | `false` | Save XHR/fetch responses to `db/raw` for debugging. |

## About the data

All listing data is public. For each posting, the app opens the public **Apply**
preview, reads the "Data Overview" advert PDF, extracts its text, and stores the
full job description plus the posting URL. Scores therefore use the full
advertisement (qualifications, skills, experience, pay) — not just the title.

A first full capture of all 26 postings takes about 2-3 minutes with three
parallel workers. Later runs reuse cached descriptions and only fetch new or
changed postings, so they are much faster. The daily scheduler does this
automatically; the manual "Fetch now" button always overrides the 24-hour
interval, and "Refresh all JDs" forces a full re-download.

## Use it from your phone (same Wi-Fi)

1. Find your computer's LAN address:
   ```bash
   ipconfig
   ```
   Use the IPv4 address of your Wi-Fi adapter (for example `192.168.1.42`).
2. Start the app bound to all interfaces:
   ```bash
   npm run dev:all:lan
   ```
   (or `npm run start:all:lan` for a production build).
3. On your phone, open `http://<your-ip>:3000` — for example
   `http://192.168.1.42:3000`.
4. If it does not load, allow Node through Windows Firewall (run once in an
   elevated terminal):
   ```powershell
   netsh advfirewall firewall add rule name="JobMatch 3000" dir=in action=allow protocol=TCP localport=3000
   ```

Keep the computer awake while the scheduler and web server run. The phone does
not need any app or account — only the same network.

## Documentation

See [DOCUMENTATION.md](DOCUMENTATION.md) for architecture, data flow, database
schema, scraper internals, and troubleshooting.
