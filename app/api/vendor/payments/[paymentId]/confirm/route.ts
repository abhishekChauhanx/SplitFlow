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

  // Ownership check — make sure this payment actually belongs to one of
  // this vendor's collections before letting them confirm/reject it.
  const payment = await prisma.vendorPayment.findUnique({
    where: { id: paymentId },
    include: { collection: true },
  });
  if (!payment || payment.collection.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  let decision: "confirmed" | "rejected" = "confirmed";
  try {
    const body = await req.json();
    if (body?.decision === "rejected") decision = "rejected";
  } catch {
    // no body sent — default to confirm, keeps old callers working
  }

  if (decision === "rejected") {
    // Rejecting deletes the payment record entirely rather than just
    // flagging it — this puts the subscriber back to "not paid" so they
    // can submit a corrected payment (right UTR, right amount, etc.)
    // without hitting the "already recorded" 409 on their next attempt.
    await prisma.vendorPayment.delete({ where: { id: paymentId } });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const updated = await prisma.vendorPayment.update({
    where: { id: paymentId },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
  return NextResponse.json(updated);
}