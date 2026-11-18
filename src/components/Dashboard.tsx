"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  JobListResult,
  JobSummary,
  ScrapeProgressInfo,
  ScrapeStatusInfo,
} from "@/lib/types";
import { JobCard } from "./JobCard";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">{value}</p>
      {hint ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 sm:text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

const MemoStatCard = memo(StatCard);

interface DashboardProps {
  initialData: JobListResult;
  initialStatus: ScrapeStatusInfo;
}

function buildParams(
  filters: {
    query: string;
    minScore: number;
    eligibleOnly: boolean;
    chance: string;
    sort: string;
  },
  offset: number,
): string {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.minScore > 0) params.set("minScore", String(filters.minScore));
  if (filters.eligibleOnly) params.set("eligible", "true");
  if (filters.chance) params.set("chance", filters.chance);
  params.set("sort", filters.sort);
  params.set("offset", String(offset));
  return params.toString();
}

export function Dashboard({ initialData, initialStatus }: DashboardProps) {
  const [jobs, setJobs] = useState<JobSummary[]>(initialData.jobs);
  const [totalJobs, setTotalJobs] = useState(initialData.totalJobs);
  const [eligibleCount, setEligibleCount] = useState(initialData.eligibleCount);
  const [matched, setMatched] = useState(initialData.matched);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [hasResume, setHasResume] = useState(initialData.hasResume);
  const [status, setStatus] = useState<ScrapeStatusInfo>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [chance, setChance] = useState("");
  const [sort, setSort] = useState("score");
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isFirstFiltersRun = useRef(true);
  const requestSeq = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/scrape/status", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as ScrapeStatusInfo;
      setStatus(data);
    } catch {
      // status is best-effort
    }
  }, []);

  useEffect(() => {
    const run = () => {
      if (!document.hidden) void loadStatus();
    };
    const initial = setTimeout(run, 0);
    const timer = setInterval(run, 15000);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!fetching) return;
    const timer = setInterval(() => void loadStatus(), 3000);
    return () => clearInterval(timer);
  }, [fetching, loadStatus]);

  useEffect(() => {
    // The server already rendered the first page for the default filters.
    if (isFirstFiltersRun.current) {
      isFirstFiltersRun.current = false;
      return;
    }

    const controller = new AbortController();
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = buildParams(
          { query, minScore, eligibleOnly, chance, sort },
          0,
        );
        const response = await fetch(`/api/jobs?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to load jobs.");
        const data = (await response.json()) as JobListResult;
        if (seq !== requestSeq.current) return;
        setJobs(data.jobs);
        setTotalJobs(data.totalJobs);
        setEligibleCount(data.eligibleCount);
        setMatched(data.matched);
        setHasMore(data.hasMore);
        setHasResume(data.hasResume);
        setError(null);
      } catch (caught) {
        if ((caught as Error).name === "AbortError") return;
        setError((caught as Error).message);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, minScore, eligibleOnly, chance, sort, refreshKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const params = buildParams(
        { query, minScore, eligibleOnly, chance, sort },
        jobs.length,
      );
      const response = await fetch(`/api/jobs?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load more jobs.");
      const data = (await response.json()) as JobListResult;
      setJobs((prev) => [...prev, ...data.jobs]);
      setMatched(data.matched);
      setHasMore(data.hasMore);
      setError(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, jobs.length, query, minScore, eligibleOnly, chance, sort]);

  const averageScore = useMemo(() => {
    const scored = jobs.filter((job) => job.score);
    if (scored.length === 0) return null;
    const total = scored.reduce((sum, job) => sum + (job.score?.total ?? 0), 0);
    return Math.round(total / scored.length);
  }, [jobs]);

  const topScore = useMemo(() => {
    if (jobs.length === 0) return null;
    return Math.max(...jobs.map((job) => job.score?.total ?? 0));
  }, [jobs]);

  const activeFilterCount =
    (minScore > 0 ? 1 : 0) +
    (eligibleOnly ? 1 : 0) +
    (chance ? 1 : 0) +
    (sort !== "score" ? 1 : 0);

  const progress: ScrapeProgressInfo | null = status?.progress ?? null;
  const progressPct =
    progress && typeof progress.done === "number" && typeof progress.total === "number" && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : null;

  const handleFetch = useCallback(
    async (refreshDetails: boolean) => {
      setFetching(true);
      setError(null);
      setMessage(null);
      try {
        const params = new URLSearchParams({ force: "true" });
        if (refreshDetails) params.set("refreshDetails", "true");
        const response = await fetch(`/api/scrape?${params.toString()}`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Scrape failed.");
        if (data.skipped) {
          setMessage(data.reason);
        } else {
          const summary = data.summary;
          const detailBits = [
            `${summary.detailsFetched ?? 0} JDs fetched`,
            `${summary.detailsReused ?? 0} cached`,
            summary.detailsFailed ? `${summary.detailsFailed} failed` : null,
            summary.ocrPages ? `${summary.ocrPages} OCR pages` : null,
          ].filter(Boolean);
          setMessage(
            `Fetched ${summary.jobsFound} jobs — ${summary.jobsNew} new, ${summary.jobsUpdated} updated. ${detailBits.join(", ")}.`,
          );
        }
        setRefreshKey((key) => key + 1);
        await loadStatus();
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setFetching(false);
      }
    },
    [loadStatus],
  );

  const isRunning = fetching || Boolean(status?.isRunning);
  const idle = totalJobs === 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Placement dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Job postings from the IIT Bombay portal, scored against your resume.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Link
            href="/resume"
            prefetch={false}
            className="flex items-center justify-center rounded-lg border border-white/15 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10"
          >
            {hasResume ? "Edit resume" : "Upload resume"}
          </Link>
          <button
            type="button"
            onClick={() => handleFetch(false)}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 active:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Fetching…
              </>
            ) : (
              "Fetch jobs now"
            )}
          </button>
          <button
            type="button"
            onClick={() => handleFetch(true)}
            disabled={isRunning}
            className="col-span-2 inline-flex items-center justify-center rounded-lg border border-white/15 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
          >
            Refresh all JDs
          </button>
        </div>
      </div>

      {isRunning && progress ? (
        <div
          className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-200 sm:p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">{progress.message}</span>
            {typeof progress.done === "number" && typeof progress.total === "number" ? (
              <span className="shrink-0 tabular-nums">
                {progress.done}/{progress.total}
              </span>
            ) : null}
          </div>
          {progressPct !== null ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!hasResume ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          No resume uploaded yet. Scores will appear after you{" "}
          <Link href="/resume" className="underline underline-offset-2">
            upload your resume
          </Link>
          .
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {status?.lastRun?.status === "error" ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Last scheduled fetch failed: {status.lastRun.error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MemoStatCard
          label="Total jobs"
          value={String(totalJobs)}
          hint={`${matched} shown after filters`}
        />
        <MemoStatCard
          label="Eligible for you"
          value={String(eligibleCount)}
          hint={totalJobs > 0 ? `${Math.round((eligibleCount / totalJobs) * 100)}% of listings` : "—"}
        />
        <MemoStatCard
          label="Top match"
          value={topScore === null ? "—" : String(topScore)}
          hint={averageScore === null ? "No scores yet" : `Avg ${averageScore} across shown`}
        />
        <MemoStatCard
          label="Last fetch"
          value={formatDateTime(status?.lastSuccessAt ?? null)}
          hint={status ? `Next: ${formatDateTime(status.nextRunAt)}` : "Scheduler: 06:00 daily"}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search role, skill…"
            aria-label="Search jobs"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-slate-200 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none sm:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className="shrink-0 rounded-lg border border-white/15 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10 sm:hidden"
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        <div
          className={`${
            showFilters ? "grid" : "hidden"
          } grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center`}
        >
          <label className="flex items-center justify-between gap-3 text-sm text-slate-300 sm:justify-start">
            <span className="shrink-0">Min score</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(event) => setMinScore(Number(event.target.value))}
              className="min-w-0 flex-1 accent-indigo-500 sm:flex-none"
            />
            <span className="w-8 shrink-0 text-right tabular-nums text-slate-400">{minScore}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(event) => setEligibleOnly(event.target.checked)}
              className="h-4 w-4 accent-indigo-500"
            />
            Eligible only
          </label>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select
              value={chance}
              onChange={(event) => setChance(event.target.value)}
              aria-label="Chance filter"
              className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-slate-200 focus:border-indigo-400/60 focus:outline-none sm:w-auto sm:py-2 sm:text-sm"
            >
              <option value="">Any chance</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort jobs"
              className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-slate-200 focus:border-indigo-400/60 focus:outline-none sm:w-auto sm:py-2 sm:text-sm"
            >
              <option value="score">Sort: Match score</option>
              <option value="deadline">Sort: Deadline</option>
              <option value="recent">Sort: Recently seen</option>
              <option value="company">Sort: Company</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500" role="status" aria-live="polite">
          Updating results…
        </p>
      ) : null}

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
          <p className="text-slate-300">
            {idle
              ? "No jobs yet. Click “Fetch jobs now” to pull the latest postings."
              : loading
                ? "Searching…"
                : "No jobs match your filters."}
          </p>
          {idle ? (
            <button
              type="button"
              onClick={() => handleFetch(false)}
              disabled={isRunning}
              className="mt-4 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 active:bg-indigo-300 disabled:opacity-60 sm:w-auto"
            >
              Fetch jobs now
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more jobs"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
