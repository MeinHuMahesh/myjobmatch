import { Dashboard } from "@/components/Dashboard";
import { INITIAL_PAGE_SIZE, queryJobSummaries } from "@/lib/jobList";
import { getStatusSnapshot } from "@/lib/status";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const initial = queryJobSummaries({
    sort: "score",
    limit: INITIAL_PAGE_SIZE,
  });
  const status = getStatusSnapshot();

  return <Dashboard initialData={initial} initialStatus={status} />;
}
