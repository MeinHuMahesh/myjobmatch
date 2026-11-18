"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { parseBrowserResume } from "@/lib/browserDocument";
import type { ResumeProfile } from "@/lib/types";
import { useResume } from "./ResumeProvider";

interface Draft {
  name: string;
  email: string;
  phone: string;
  degree: string;
  branch: string;
  cgpa: string;
  graduationYear: string;
  skills: string;
  targetRoles: string;
  experienceMonths: string;
  projects: string;
  certifications: string;
}

function toDraft(profile: ResumeProfile): Draft {
  return {
    name: profile.name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    degree: profile.degree ?? "",
    branch: profile.branch ?? "",
    cgpa: profile.cgpa === null ? "" : String(profile.cgpa),
    graduationYear: profile.graduationYear === null ? "" : String(profile.graduationYear),
    skills: profile.skills.join(", "),
    targetRoles: profile.targetRoles.join(", "),
    experienceMonths: String(profile.experienceMonths),
    projects: profile.projects.join("\n"),
    certifications: profile.certifications.join("\n"),
  };
}

function toLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-base text-slate-200 placeholder:text-slate-600 focus:border-indigo-400/60 focus:outline-none sm:py-2 sm:text-sm"
      />
    </label>
  );
}

export function ResumeEditorStatic() {
  const { profile, ready, saveProfile } = useResume();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveDraft = draft ?? (ready && profile ? toDraft(profile) : null);

  async function uploadFile(file: File): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("File is larger than 8 MB.");
      const next = await parseBrowserResume(file);
      saveProfile(next);
      setDraft(toDraft(next));
      setMessage("Resume parsed. Scores recalculated locally on this device.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function save(): void {
    if (!effectiveDraft) return;
    setError(null);
    setMessage(null);
    const next: ResumeProfile = {
      fileName: profile?.fileName ?? "resume.txt",
      rawText: profile?.rawText ?? "",
      name: effectiveDraft.name || null,
      email: effectiveDraft.email || null,
      phone: effectiveDraft.phone || null,
      degree: effectiveDraft.degree || null,
      branch: effectiveDraft.branch || null,
      cgpa: effectiveDraft.cgpa === "" ? null : Number(effectiveDraft.cgpa),
      graduationYear:
        effectiveDraft.graduationYear === "" ? null : Number(effectiveDraft.graduationYear),
      education: profile?.education ?? [],
      skills: toList(effectiveDraft.skills),
      targetRoles: toList(effectiveDraft.targetRoles),
      experienceMonths: Number(effectiveDraft.experienceMonths) || 0,
      projects: toLines(effectiveDraft.projects),
      certifications: toLines(effectiveDraft.certifications),
      updatedAt: new Date().toISOString(),
    };
    saveProfile(next);
    setDraft(toDraft(next));
    setMessage("Saved. Scores recalculated locally on this device.");
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...(current ?? effectiveDraft!), [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Your resume</h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload a PDF or DOCX. Parsing and scoring happen in your browser — your resume is never
            uploaded.
          </p>
        </div>
        <Link
          href="/"
          className="flex min-h-11 w-full items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 active:bg-white/10 sm:w-auto"
        >
          Back to dashboard
        </Link>
      </div>

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

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-200">Upload / replace resume</h2>
        <p className="mt-1 text-xs text-slate-500">PDF, DOCX, or TXT up to 8 MB. Stored only in this browser.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
            className="w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-3 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-400"
          />
          {busy ? <span className="text-sm text-slate-400">Working…</span> : null}
        </div>
      </div>

      {!ready ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400 sm:p-10">
          Loading profile…
        </div>
      ) : effectiveDraft ? (
        <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={effectiveDraft.name} onChange={(value) => update("name", value)} />
            <Field label="Email" value={effectiveDraft.email} onChange={(value) => update("email", value)} />
            <Field label="Phone" value={effectiveDraft.phone} onChange={(value) => update("phone", value)} />
            <Field label="Degree" value={effectiveDraft.degree} onChange={(value) => update("degree", value)} placeholder="B.Tech" />
            <Field label="Branch" value={effectiveDraft.branch} onChange={(value) => update("branch", value)} placeholder="Computer Science" />
            <Field label="CGPA / CPI" type="number" value={effectiveDraft.cgpa} onChange={(value) => update("cgpa", value)} placeholder="8.5" />
            <Field label="Graduation year" type="number" value={effectiveDraft.graduationYear} onChange={(value) => update("graduationYear", value)} placeholder="2026" />
            <Field label="Experience (months)" type="number" value={effectiveDraft.experienceMonths} onChange={(value) => update("experienceMonths", value)} placeholder="0" />
            <Field label="Target roles (comma separated)" value={effectiveDraft.targetRoles} onChange={(value) => update("targetRoles", value)} placeholder="Software Engineer, Backend Engineer" />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Skills (comma separated)
            </span>
            <textarea
              value={effectiveDraft.skills}
              onChange={(event) => update("skills", event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-base text-slate-200 focus:border-indigo-400/60 focus:outline-none sm:py-2 sm:text-sm"
            />
          </label>

          {profile && profile.education.length > 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Education history
              </h3>
              <ul className="mt-2 space-y-2">
                {profile.education.map((entry, index) => (
                  <li key={`${entry.degree}-${index}`} className="text-sm">
                    <p className="text-slate-200">
                      <span className="font-medium">{entry.degree}</span>
                      {entry.specialization ? ` · ${entry.specialization}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[entry.institution, entry.year, entry.score]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                Highest qualification is used for scoring. Use the Degree and Branch fields
                above to override it.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Projects (one per line)
              </span>
              <textarea
                value={effectiveDraft.projects}
                onChange={(event) => update("projects", event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-base text-slate-200 focus:border-indigo-400/60 focus:outline-none sm:py-2 sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Certifications (one per line)
              </span>
              <textarea
                value={effectiveDraft.certifications}
                onChange={(event) => update("certifications", event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-base text-slate-200 focus:border-indigo-400/60 focus:outline-none sm:py-2 sm:text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              className="min-h-11 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 active:bg-indigo-300 sm:w-auto"
            >
              Save & recompute scores
            </button>
            <button
              type="button"
              onClick={() => {
                saveProfile(null);
                setDraft(null);
                setMessage(null);
              }}
              className="min-h-11 w-full rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 sm:w-auto"
            >
              Remove resume
            </button>
          </div>

          {profile ? (
            <details className="rounded-lg border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-xs font-medium text-slate-400">
                View extracted raw text ({profile.fileName})
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-400">
                {profile.rawText}
              </pre>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400 sm:p-10">
          Upload a resume to build your profile.
        </div>
      )}
    </div>
  );
}
