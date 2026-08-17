import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const trustScore = await prisma.trustScore.findUnique({ where: { userId } });

  // If no score exists yet (brand new user, no settlements), return the default
  return NextResponse.json(
    trustScore || {
      score: 50,
      label: "New member",
      onTimeRate: 0,
      disputeRate: 0,
      utrSubmissionRate: 0,
      completionRate: 0,
      totalSettlements: 0,
    }
  );
}