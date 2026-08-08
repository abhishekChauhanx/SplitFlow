import { NextResponse } from "next/server";
import { getGroupSummary } from "@/lib/group-summary";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const summary = await getGroupSummary(id);
  if (!summary) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  return NextResponse.json(summary);
}