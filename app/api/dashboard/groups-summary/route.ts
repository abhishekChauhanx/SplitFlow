import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getDashboardGroupSummaries } from "@/lib/dashboard-summary";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await getDashboardGroupSummaries(userId);
  return NextResponse.json(rows);
}