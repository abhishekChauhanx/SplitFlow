import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  return NextResponse.json({ userId });
}