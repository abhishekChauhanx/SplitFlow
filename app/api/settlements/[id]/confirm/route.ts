import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { sendPushToUser } from "@/lib/webpush";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPayer = settlement.fromUserId === userId;
  const isPayee = settlement.toUserId === userId;
  if (!isPayer && !isPayee) {
    return NextResponse.json({ error: "Not part of this settlement" }, { status: 403 });
  }

  // Idempotent: if this side already confirmed, just return current state, don't double-process
  if (isPayer && settlement.payerConfirmedAt) {
    return NextResponse.json(settlement);
  }
  if (isPayee && settlement.payeeConfirmedAt) {
    return NextResponse.json(settlement);
  }

  const updateData: any = isPayer
    ? { payerConfirmedAt: new Date() }
    : { payeeConfirmedAt: new Date() };

  const otherSideAlreadyConfirmed = isPayer
    ? settlement.payeeConfirmedAt
    : settlement.payerConfirmedAt;

  updateData.status = otherSideAlreadyConfirmed ? "both_confirmed" : "payer_confirmed";
  if (isPayee && !settlement.payerConfirmedAt) {
    updateData.status = "payee_confirmed_first"; // rare case: payee confirms before payer
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: updateData,
  });
const notifyUserId = isPayer ? settlement.toUserId : settlement.fromUserId;
const message = updated.status === "both_confirmed"
  ? "Both sides confirmed — settlement complete! ✓"
  : isPayer
    ? "Payer confirmed — please confirm on your side to complete."
    : "Payee confirmed — waiting for payer to confirm.";

await sendPushToUser(notifyUserId, {
  title: "Settlement update",
  body: message,
  url: `/groups/${settlement.groupId}/settle`,
}).catch(() => {});
  return NextResponse.json(updated);
}