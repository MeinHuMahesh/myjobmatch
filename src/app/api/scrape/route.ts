import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scrape-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const forceParam = url.searchParams.get("force");
  const force = forceParam === "true" || forceParam === "1";
  const detailsParam = url.searchParams.get("details");
  const details =
    detailsParam === "false" ? false : detailsParam === "true" ? true : undefined;
  const refreshParam = url.searchParams.get("refreshDetails");
  const refreshDetails =
    refreshParam === "true" || refreshParam === "1";
  try {
    const result = await runScrape({ force, details, refreshDetails });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
