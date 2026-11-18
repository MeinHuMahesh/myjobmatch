import Link from "next/link";
import { memo } from "react";
import type { JobSummary } from "@/lib/types";
import { ScoreGauge } from "./ScoreGauge";

export function chanceClasses(chance?: string): string {
  switch (chance) {
    case "High":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "Medium":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "Low":
      return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
}

function Chip({ text, tone }: { text: string; tone: "good" | "bad" | "neutral" }) {
  const classes =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
      : tone === "bad"
        ? "bg-rose-500/10 text-rose-300 border-rose-500/25"
        : "bg-slate-500/10 text-slate-300 border-slate-500/20";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${classes}`}>{text}</span>
  );
}

export const JobCard = memo(function JobCard({ job }: { job: JobSummary }) {
  const score = job.score;
  const matched = score?.matchedSkills ?? [];
  const missing = score?.missingMustHave ?? [];
  const meta = [
    job.jobType,
    job.ctc ? `CTC: ${job.ctc}` : null,
    job.stipend ? `Stipend: ${job.stipend}` : null,
    job.deadline ? `Deadline: ${job.deadline}` : null,
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/jobs/${job.id}`}
      prefetch={false}
      className="job-card block rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-indigo-400/40 hover:bg-white/[0.05] active:bg-white/[0.06] sm:p-4"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-100">
              {job.title}
            </h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chanceClasses(
                score?.chance,
              )}`}
            >
              {score ? `${score.chance} chance` : "Not scored"}
            </span>
            {score && !score.eligible ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                Not eligible
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-400">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>

          {meta.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
              {meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}

          {matched.length > 0 || missing.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matched.slice(0, 4).map((skill) => (
                <Chip key={`m-${skill}`} text={skill} tone="good" />
              ))}
              {missing.slice(0, 2).map((skill) => (
                <Chip key={`x-${skill}`} text={`missing: ${skill}`} tone="bad" />
              ))}
            </div>
          ) : null}

          {score?.summary ? (
            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{score.summary}</p>
          ) : null}
        </div>
        <div className="shrink-0">
          <ScoreGauge score={score?.total ?? 0} label="match" />
        </div>
      </div>
    </Link>
  );
});
