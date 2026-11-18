import { NextResponse } from "next/server";
import { getResume } from "@/lib/db";
import { rescoreAll } from "@/lib/scrape-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const resume = getResume();
  if (!resume) {
    return NextResponse.json(
      { error: "Upload a resume before computing scores." },
      { status: 400 },
    );
  }
  const rescored = rescoreAll();
  return NextResponse.json({ rescored });
}
