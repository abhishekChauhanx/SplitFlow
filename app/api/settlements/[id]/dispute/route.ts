import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { reason } = await req.json();

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
    return NextResponse.json({ error: "Not part of this settlement" }, { status: 403 });
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: { status: "disputed", disputeReason: reason },
  });

  return NextResponse.json(updated);
}