import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params;
  const requesterId = await getSessionUserId();
  if (!requesterId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const trustScore = await prisma.trustScore.findUnique({ where: { userId: targetUserId } });

  // Only expose label + score publicly — NOT the granular breakdown
  // (dispute rate, UTR rate, etc.) which is more sensitive detail
  // reserved for the user's own view of their own score.
  return NextResponse.json({
    score: trustScore?.score ?? 50,
    label: trustScore?.label ?? "New member",
    totalSettlements: trustScore?.totalSettlements ?? 0,
  });
}