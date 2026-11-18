import { NextResponse } from "next/server";
import { DEFAULT_PAGE_SIZE, queryJobSummaries } from "@/lib/jobList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const result = queryJobSummaries({
    q: url.searchParams.get("q") ?? "",
    minScore: Number(url.searchParams.get("minScore") ?? "0"),
    eligible: url.searchParams.get("eligible") === "true",
    chance: url.searchParams.get("chance"),
    sort: url.searchParams.get("sort"),
    offset: Number(url.searchParams.get("offset") ?? "0"),
    limit: Number(url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE)),
  });

  return NextResponse.json(result);
}
