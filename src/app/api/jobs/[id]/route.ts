import { NextResponse } from "next/server";
import { getJobById, getResume, getScore, saveScore } from "@/lib/db";
import { scoreJob } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
  }
  const job = getJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const resume = getResume();
  let score = getScore(jobId);
  if (resume && !score) {
    score = scoreJob(resume, job);
    saveScore(job.id, resume.updatedAt, score);
  }

  return NextResponse.json({ job, score, hasResume: Boolean(resume) });
}
