import { Dashboard } from "@/components/Dashboard";
import { DashboardStatic } from "@/components/DashboardStatic";
import { INITIAL_PAGE_SIZE, queryJobSummaries } from "@/lib/jobList";
import { getStatusSnapshot } from "@/lib/status";

export default function HomePage() {
  if (process.env.PAGES_EXPORT === "1") {
    return <DashboardStatic />;
  }

  const initial = queryJobSummaries({
    sort: "score",
    limit: INITIAL_PAGE_SIZE,
  });
  const status = getStatusSnapshot();

  return <Dashboard initialData={initial} initialStatus={status} />;
}
