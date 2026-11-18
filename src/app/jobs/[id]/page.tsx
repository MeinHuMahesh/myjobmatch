import Link from "next/link";
import { notFound } from "next/navigation";
import { JobDescription } from "@/components/JobDescription";
import { chanceClasses } from "@/components/JobCard";
import { ScoreGauge, scoreColor } from "@/components/ScoreGauge";
import { getJobById, getResume, getScore, saveScore } from "@/lib/db";
import { scoreJob } from "@/lib/scoring";

export const dynamic = "force-dynamic";

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-300">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: scoreColor(value) }}
        />
      </div>
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "good" | "bad" | "neutral" }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">None</p>;
  const classes =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
      : tone === "bad"
        ? "bg-rose-500/10 text-rose-300 border-rose-500/25"
        : "bg-slate-500/10 text-slate-300 border-slate-500/20";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className={`rounded-full border px-2 py-0.5 text-xs ${classes}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();
  const job = getJobById(jobId);
  if (!job) notFound();

  const resume = getResume();
  let score = getScore(jobId);
  if (resume && !score) {
    score = scoreJob(resume, job);
    saveScore(job.id, resume.updatedAt, score);
  }

  const meta = [
    ["Location", job.location],
    ["Type", job.jobType],
    ["CTC", job.ctc],
    ["Stipend", job.stipend],
    ["Deadline", job.deadline],
    ["Branches", job.eligibleBranches.join(", ") || null],
    ["Degrees", job.eligibleDegrees.join(", ") || null],
    ["Min CGPA", job.minCgpa === null ? null : String(job.minCgpa)],
    ["Batches", job.graduationYears.length > 0 ? job.graduationYears.join(", ") : null],
  ].filter(([, value]) => Boolean(value)) as [string, string][];

  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="inline-flex min-h-9 items-center text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← Back to dashboard
      </Link>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold leading-snug text-white sm:text-xl">
                {job.title}
              </h1>
              {score ? (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chanceClasses(
                    score.chance,
                  )}`}
                >
                  {score.chance} chance
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {job.company}
              {job.location ? ` · ${job.location}` : ""}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {job.applyUrl ? (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-indigo-400 active:bg-indigo-300 sm:w-auto"
                >
                  Apply / view posting
                </a>
              ) : (
                <a
                  href="https://ep.iitb.ac.in/jobsearch"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-center text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10 sm:w-auto"
                >
                  Open portal
                </a>
              )}
            </div>
          </div>
          {score ? <ScoreGauge score={score.total} size={96} label="match" /> : null}
        </div>

        {meta.length > 0 ? (
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {meta.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-slate-500">{label}:</dt>
                <dd className="min-w-0 text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {score ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-200">Score breakdown</h2>
            <p className="mt-1 text-xs text-slate-500">{score.summary}</p>
            <div className="mt-4 space-y-3">
              <Bar label="Skill match" value={score.skillScore} />
              <Bar label="Role similarity" value={score.roleScore} />
              <Bar label="Experience fit" value={score.experienceScore} />
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Matched skills</p>
                <Chips items={score.matchedSkills} tone="good" />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Missing must-have</p>
                <Chips items={score.missingMustHave} tone="bad" />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Missing nice-to-have</p>
                <Chips items={score.missingNiceToHave} tone="neutral" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-200">Eligibility checklist</h2>
            <ul className="mt-3 space-y-2">
              {score.checks.map((check) => (
                <li key={check.label} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] ${
                      check.passed
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {check.passed ? "✓" : "✕"}
                  </span>
                  <span>
                    <span className="text-slate-200">{check.label}:</span>{" "}
                    <span className="text-slate-400">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 sm:p-5">
          Upload your resume to see the favourability score for this job.{" "}
          <Link href="/resume" className="underline underline-offset-2">
            Go to resume
          </Link>
          .
        </div>
      )}

      <JobDescription
        text={job.description ?? job.rawText ?? ""}
        source={job.jdSource}
        status={job.jdStatus}
      />
    </div>
  );
}
