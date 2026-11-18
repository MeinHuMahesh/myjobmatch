"use client";

import { JobDetailContent } from "@/components/JobDetailContent";
import { useResume } from "@/components/ResumeProvider";
import type { JobRecord } from "@/lib/types";

export function StaticJobDetail({ job }: { job: JobRecord }) {
  const { scores } = useResume();
  return <JobDetailContent job={job} score={scores.get(job.id) ?? null} />;
}
