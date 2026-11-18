import { NextResponse } from "next/server";
import { getStatusSnapshot } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getStatusSnapshot());
}
