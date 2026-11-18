import { NextResponse } from "next/server";
import { getResume, saveResume } from "@/lib/db";
import { parseResumeFile } from "@/lib/parseResume";
import { rescoreAll } from "@/lib/scrape-service";
import { normalizeSkillList } from "@/lib/skills";
import type { ResumeProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(): Promise<NextResponse> {
  const resume = getResume();
  if (!resume) {
    return NextResponse.json({ error: "No resume uploaded yet." }, { status: 404 });
  }
  return NextResponse.json(resume);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File is too large (max 8 MB)." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const profile = await parseResumeFile(file.name, buffer);
    saveResume(profile);
    const rescored = rescoreAll();
    return NextResponse.json({ profile, rescored });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

interface PartialProfile {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  degree?: string | null;
  branch?: string | null;
  cgpa?: number | string | null;
  graduationYear?: number | string | null;
  skills?: string[];
  targetRoles?: string[];
  experienceMonths?: number | string;
  projects?: string[];
  certifications?: string[];
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const existing = getResume();
  if (!existing) {
    return NextResponse.json(
      { error: "Upload a resume before editing the profile." },
      { status: 404 },
    );
  }
  try {
    const body = (await request.json()) as PartialProfile;
    const toNumberOrNull = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const updated: ResumeProfile = {
      ...existing,
      name: body.name !== undefined ? (body.name ?? null) : existing.name,
      email: body.email !== undefined ? (body.email ?? null) : existing.email,
      phone: body.phone !== undefined ? (body.phone ?? null) : existing.phone,
      degree: body.degree !== undefined ? (body.degree ?? null) : existing.degree,
      branch: body.branch !== undefined ? (body.branch ?? null) : existing.branch,
      cgpa: body.cgpa !== undefined ? toNumberOrNull(body.cgpa) : existing.cgpa,
      graduationYear:
        body.graduationYear !== undefined
          ? toNumberOrNull(body.graduationYear)
          : existing.graduationYear,
      skills: body.skills ? normalizeSkillList(body.skills) : existing.skills,
      targetRoles: toStringArray(body.targetRoles) ?? existing.targetRoles,
      experienceMonths:
        body.experienceMonths !== undefined
          ? Math.max(0, Math.round(Number(body.experienceMonths) || 0))
          : existing.experienceMonths,
      projects: toStringArray(body.projects) ?? existing.projects,
      certifications: toStringArray(body.certifications) ?? existing.certifications,
      updatedAt: new Date().toISOString(),
    };

    saveResume(updated);
    const rescored = rescoreAll();
    return NextResponse.json({ profile: updated, rescored });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
