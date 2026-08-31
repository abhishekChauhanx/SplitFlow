import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { generateGroupStatement } from "@/lib/statement-generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodDays = parseInt(searchParams.get("days") || "30");

  const statement = await generateGroupStatement(id, periodDays);
  return NextResponse.json(statement);
}