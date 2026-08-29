import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { recalculateAndSaveTrustScore } from "@/lib/trust-score";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (settlement.status !== "disputed") {
    return NextResponse.json({ error: "Only disputed settlements can be arbitrated" }, { status: 400 });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: settlement.groupId, userId } },
  });
  if (!membership?.isAdmin) {
    return NextResponse.json({ error: "Only group admins can resolve disputes" }, { status: 403 });
  }

  const { decision, note } = await req.json(); // decision: "payer" | "payee"
  if (decision !== "payer" && decision !== "payee") {
    return NextResponse.json({ error: "Decision must be 'payer' or 'payee'" }, { status: 400 });
  }
  if (!note || !note.trim()) {
    return NextResponse.json({ error: "Please explain your decision" }, { status: 400 });
  }

  const updateData: any = {
    arbitratedById: userId,
    arbitrationDecision: decision,
    arbitrationNote: note.trim(),
    arbitratedAt: new Date(),
  };

  if (decision === "payer") {
    // Admin believes the payer's claim — settlement is genuinely complete
    updateData.status = "both_confirmed";
  } else {
    // Admin believes the payee — payment didn't happen, reset for a retry
    updateData.status = "pending";
    updateData.payerConfirmedAt = null;
    updateData.payeeConfirmedAt = null;
    updateData.utrNumber = null;
    updateData.disputeReason = null;
  }

  const updated = await prisma.settlement.update({ where: { id }, data: updateData });

  await recalculateAndSaveTrustScore(settlement.fromUserId).catch(() => {});

  return NextResponse.json(updated);
}