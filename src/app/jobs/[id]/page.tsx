import { notFound } from "next/navigation";
import { JobDetailContent } from "@/components/JobDetailContent";
import { StaticJobDetail } from "@/components/StaticJobDetail";
import { getJobById, getScore } from "@/lib/db";
import { getSnapshotJob, snapshotJobs } from "@/lib/snapshot";

const isPagesExport = process.env.PAGES_EXPORT === "1";

export const dynamicParams = false;

export function generateStaticParams() {
  return snapshotJobs.map((job) => ({ id: String(job.id) }));
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();

  if (isPagesExport) {
    const job = getSnapshotJob(jobId);
    if (!job) notFound();
    return <StaticJobDetail job={job} />;
  }

  const job = getJobById(jobId);
  if (!job) notFound();
  const score = getScore(jobId);
  return <JobDetailContent job={job} score={score} />;
}
