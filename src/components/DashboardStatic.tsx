"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { querySnapshotJobs, snapshotGeneratedAt } from "@/lib/snapshot";
import { JobCard } from "./JobCard";
import { useResume } from "./ResumeProvider";

const PAGE_SIZE = 20;
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

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

export function DashboardStatic() {
  const { profile, ready, scores } = useResume();
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [chance, setChance] = useState("");
  const [sort, setSort] = useState("score");
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filters = useMemo(
    () => ({ query, minScore, eligibleOnly, chance, sort }),
    [query, minScore, eligibleOnly, chance, sort],
  );

  const result = useMemo(
    () =>
      querySnapshotJobs(
        {
          q: filters.query,
          minScore: filters.minScore,
          eligible: filters.eligibleOnly,
          chance: filters.chance,
          sort: filters.sort,
          limit: 1000,
        },
        scores,
      ),
    [filters, scores],
  );

  const shownJobs = result.jobs.slice(0, visible);
  const hasMore = visible < result.jobs.length;

  const averageScore = useMemo(() => {
    const scored = shownJobs.filter((job) => job.score);
    if (scored.length === 0) return null;
    return Math.round(
      scored.reduce((sum, job) => sum + (job.score?.total ?? 0), 0) / scored.length,
    );
  }, [shownJobs]);

  const topScore = shownJobs.length
    ? Math.max(...shownJobs.map((job) => job.score?.total ?? 0))
    : null;

  const activeFilterCount =
    (minScore > 0 ? 1 : 0) +
    (eligibleOnly ? 1 : 0) +
    (chance ? 1 : 0) +
    (sort !== "score" ? 1 : 0);

  const resetVisible = () => setVisible(PAGE_SIZE);
  const hasResume = Boolean(ready && profile);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Placement dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Job postings from the IIT Bombay portal, scored in your browser against your resume.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/resume"
            prefetch={false}
            className="flex items-center justify-center rounded-lg border border-white/15 px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10"
          >
            {hasResume ? "Edit resume" : "Upload resume"}
          </Link>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Snapshot generated {dateFormatter.format(new Date(snapshotGeneratedAt))} UTC. Scoring and
        your resume stay on this device.
      </p>

      {!hasResume ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          No resume on this device yet. Scores appear after you{" "}
          <Link href="/resume" className="underline underline-offset-2">
            add your resume
          </Link>
          .
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total jobs"
          value={String(result.totalJobs)}
          hint={`${result.matched} shown after filters`}
        />
        <StatCard
          label="Eligible for you"
          value={String(result.eligibleCount)}
          hint={
            result.totalJobs > 0
              ? `${Math.round((result.eligibleCount / result.totalJobs) * 100)}% of listings`
              : "—"
          }
        />
        <StatCard
          label="Top match"
          value={topScore === null ? "—" : String(topScore)}
          hint={averageScore === null ? "No scores yet" : `Avg ${averageScore} across shown`}
        />
        <StatCard
          label="Last update"
          value={dateFormatter.format(new Date(snapshotGeneratedAt)).split(",")[0]}
          hint="Daily snapshot"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetVisible();
            }}
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
              onChange={(event) => {
                setMinScore(Number(event.target.value));
                resetVisible();
              }}
              className="min-w-0 flex-1 accent-indigo-500 sm:flex-none"
            />
            <span className="w-8 shrink-0 text-right tabular-nums text-slate-400">{minScore}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(event) => {
                setEligibleOnly(event.target.checked);
                resetVisible();
              }}
              className="h-4 w-4 accent-indigo-500"
            />
            Eligible only
          </label>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <select
              value={chance}
              onChange={(event) => {
                setChance(event.target.value);
                resetVisible();
              }}
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
              onChange={(event) => {
                setSort(event.target.value);
                resetVisible();
              }}
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

      {shownJobs.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
          <p className="text-slate-300">
            {result.totalJobs === 0
              ? "No jobs in the current snapshot."
              : "No jobs match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shownJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10"
          >
            Load more jobs
          </button>
        </div>
      ) : null}
    </div>
  );
}
