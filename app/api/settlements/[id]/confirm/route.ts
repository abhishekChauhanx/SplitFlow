import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { group: { select: { groupType: true, propertyAddress: true } } },
  });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPayer = settlement.fromUserId === userId;
  const isPayee = settlement.toUserId === userId;
  if (!isPayer && !isPayee) {
    return NextResponse.json({ error: "Not part of this settlement" }, { status: 403 });
  }

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
    updateData.status = "payee_confirmed_first";
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: updateData,
  });

  // ── NEW: auto-generate rent receipt the moment both sides confirm ──
  // Only fires for "rent" type groups, and only if a receipt doesn't already exist
  if (updated.status === "both_confirmed" && settlement.group.groupType === "rent") {
    const existingReceipt = await prisma.rentReceipt.findUnique({
      where: { settlementId: id },
    });

    if (!existingReceipt) {
      // Infer the payment period as the calendar month the settlement was created in.
      // This is a reasonable default for monthly rent — no manual date entry needed.
      const createdAt = settlement.createdAt;
      const periodFrom = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
      const periodTo = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 0);

      const landlordVendor = await prisma.vendor.findUnique({
        where: { userId: settlement.toUserId },
      });

      await prisma.rentReceipt.create({
        data: {
          settlementId: id,
          tenantId: settlement.fromUserId,
          landlordId: settlement.toUserId,
          landlordPan: landlordVendor?.panNumber || null,
          propertyAddress: settlement.group.propertyAddress || "Address not set",
          amountPaise: settlement.amountPaise,
          paymentPeriodFrom: periodFrom,
          paymentPeriodTo: periodTo,
          utrNumber: settlement.utrNumber,
          status: "pending_signature",
        },
      });
    }
  }

  return NextResponse.json(updated);
}