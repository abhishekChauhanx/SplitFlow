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

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only allow generating a receipt for a fully confirmed settlement
  if (settlement.status !== "both_confirmed") {
    return NextResponse.json(
      { error: "Receipts can only be generated after both sides confirm the payment" },
      { status: 400 }
    );
  }

  // Only the payer (tenant) can request a receipt
  if (settlement.fromUserId !== userId) {
    return NextResponse.json({ error: "Only the payer can request a receipt" }, { status: 403 });
  }

  const existing = await prisma.rentReceipt.findUnique({ where: { settlementId: id } });
  if (existing) return NextResponse.json(existing);

  const { propertyAddress, paymentPeriodFrom, paymentPeriodTo } = await req.json();

  if (!propertyAddress || !paymentPeriodFrom || !paymentPeriodTo) {
    return NextResponse.json(
      { error: "Property address and payment period are required" },
      { status: 400 }
    );
  }

  // Look up landlord's PAN if they have a vendor profile
  const landlordVendor = await prisma.vendor.findUnique({
    where: { userId: settlement.toUserId },
  });

  const receipt = await prisma.rentReceipt.create({
    data: {
      settlementId: id,
      tenantId: settlement.fromUserId,
      landlordId: settlement.toUserId,
      landlordPan: landlordVendor?.panNumber || null,
      propertyAddress,
      amountPaise: settlement.amountPaise,
      paymentPeriodFrom: new Date(paymentPeriodFrom),
      paymentPeriodTo: new Date(paymentPeriodTo),
      utrNumber: settlement.utrNumber,
      status: "pending_signature",
    },
  });

  return NextResponse.json(receipt);
}