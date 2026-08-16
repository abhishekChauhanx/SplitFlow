import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const { decision } = await req.json(); // "confirmed" | "rejected"

  const existingPayment = await prisma.vendorPayment.findUnique({
    where: { id: paymentId },
    include: { collection: true },
  });

  if (!existingPayment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (existingPayment.collection.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Not your collection" }, { status: 403 });
  }

  if (decision === "rejected") {
    // Delete the payment so the subscriber can submit a fresh one
    await prisma.vendorPayment.delete({ where: { id: paymentId } });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const payment = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "confirmed", confirmedAt: new Date() },
    include: { subscriber: true, collection: true },
  });

  // Auto-generate rent receipt, only for landlord-type vendors
  if (vendor.businessType === "landlord") {
    const existingReceipt = await prisma.rentReceipt.findUnique({
      where: { vendorPaymentId: payment.id },
    });

    if (!existingReceipt && payment.subscriber.userId) {
      let periodFrom: Date;
      let periodTo: Date;

      if (payment.collection.cycleMonth) {
        const [year, month] = payment.collection.cycleMonth.split("-").map(Number);
        periodFrom = new Date(year, month - 1, 1);
        periodTo = new Date(year, month, 0);
      } else {
        const now = new Date();
        periodFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      await prisma.rentReceipt.create({
        data: {
          vendorPaymentId: payment.id,
          tenantId: payment.subscriber.userId,
          landlordId: userId,
          landlordPan: vendor.panNumber || null,
          propertyAddress: payment.collection.propertyAddress || "Address not set",
          amountPaise: payment.amountPaise,
          paymentPeriodFrom: periodFrom,
          paymentPeriodTo: periodTo,
          utrNumber: payment.utrNumber,
          status: "pending_signature",
        },
      });
    }
  }

  return NextResponse.json(payment);
}