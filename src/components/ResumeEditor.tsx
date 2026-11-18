"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RESUME_ACCEPT, isSupportedResumeFile } from "@/lib/browserDocument";
import type { ResumeProfile } from "@/lib/types";

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

export function ResumeEditor() {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/resume", { cache: "no-store" });
        if (response.status === 404) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await response.json()) as ResumeProfile;
        if (!cancelled) {
          setProfile(data);
          setDraft(toDraft(data));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadFile(file: File): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    setSelectedName(file.name);
    try {
      if (!isSupportedResumeFile(file)) {
        throw new Error("Unsupported file type. Please upload a PDF, DOCX, TXT, or MD file.");
      }
      if (file.size > 8 * 1024 * 1024) throw new Error("File is larger than 8 MB.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/resume", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setProfile(data.profile as ResumeProfile);
      setDraft(toDraft(data.profile as ResumeProfile));
      setMessage(`Resume parsed. Scores recalculated for ${data.rescored} jobs.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save(): Promise<void> {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/resume", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name || null,
          email: draft.email || null,
          phone: draft.phone || null,
          degree: draft.degree || null,
          branch: draft.branch || null,
          cgpa: draft.cgpa === "" ? null : Number(draft.cgpa),
          graduationYear: draft.graduationYear === "" ? null : Number(draft.graduationYear),
          skills: toList(draft.skills),
          targetRoles: toList(draft.targetRoles),
          experienceMonths: Number(draft.experienceMonths) || 0,
          projects: toLines(draft.projects),
          certifications: toLines(draft.certifications),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Save failed.");
      setProfile(data.profile as ResumeProfile);
      setDraft(toDraft(data.profile as ResumeProfile));
      setMessage(`Saved. Scores recalculated for ${data.rescored} jobs.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Your resume</h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload a PDF or DOCX. Review and correct the extracted profile — scoring uses these fields.
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
        <p className="mt-1 text-xs text-slate-500">PDF, DOCX, TXT, or MD up to 8 MB.</p>
        <div className="mt-3">
          <div className="relative inline-flex min-h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 active:bg-indigo-600 sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept={RESUME_ACCEPT}
              disabled={busy}
              aria-label="Choose resume file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
            <span>{busy ? "Working…" : "Choose resume file"}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500" aria-live="polite">
            {selectedName ? `Selected: ${selectedName}` : "Tap the button to browse your files."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400 sm:p-10">
          Loading profile…
        </div>
      ) : draft ? (
        <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={draft.name} onChange={(value) => update("name", value)} />
            <Field label="Email" value={draft.email} onChange={(value) => update("email", value)} />
            <Field label="Phone" value={draft.phone} onChange={(value) => update("phone", value)} />
            <Field label="Degree" value={draft.degree} onChange={(value) => update("degree", value)} placeholder="B.Tech" />
            <Field label="Branch" value={draft.branch} onChange={(value) => update("branch", value)} placeholder="Computer Science" />
            <Field label="CGPA / CPI" type="number" value={draft.cgpa} onChange={(value) => update("cgpa", value)} placeholder="8.5" />
            <Field label="Graduation year" type="number" value={draft.graduationYear} onChange={(value) => update("graduationYear", value)} placeholder="2026" />
            <Field label="Experience (months)" type="number" value={draft.experienceMonths} onChange={(value) => update("experienceMonths", value)} placeholder="0" />
            <Field label="Target roles (comma separated)" value={draft.targetRoles} onChange={(value) => update("targetRoles", value)} placeholder="Software Engineer, Backend Engineer" />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Skills (comma separated)
            </span>
            <textarea
              value={draft.skills}
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
                value={draft.projects}
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
                value={draft.certifications}
                onChange={(event) => update("certifications", event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-base text-slate-200 focus:border-indigo-400/60 focus:outline-none sm:py-2 sm:text-sm"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="min-h-11 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 active:bg-indigo-300 disabled:opacity-60 sm:w-auto"
            >
              {busy ? "Saving…" : "Save & recompute scores"}
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
