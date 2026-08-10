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

  const { reason, resolution } = await req.json();

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
    return NextResponse.json({ error: "Not part of this settlement" }, { status: 403 });
  }

  // Resolution options:
  // undefined/"flag" = default — flags the settlement as disputed
  // "reopen"  = resets to pending so the payer can retry (either side can do this)
  // "forgive" = marks both_confirmed anyway (only the payee can do this)

  let updateData: any = {};

  if (resolution === "reopen") {
    updateData = {
      status: "pending",
      disputeReason: null,
      payerConfirmedAt: null,
      payeeConfirmedAt: null,
      // Clear any old UTR too — otherwise settle page's pendingSettlementFor()
      // still sees "proof of payment" attached and keeps the Pay button locked,
      // even though the whole point of reopening is to let them pay again.
      utrNumber: null,
    };
  } else if (resolution === "forgive") {
    // Only the payee (person owed money) can forgive — the payer shouldn't be
    // able to unilaterally wave away a dispute about their own payment.
    if (settlement.toUserId !== userId) {
      return NextResponse.json({ error: "Only the recipient can forgive a dispute" }, { status: 403 });
    }
    updateData = { status: "both_confirmed", disputeReason: `Forgiven: ${reason || "no reason given"}` };
  } else {
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "Please describe what doesn't match" }, { status: 400 });
    }
    updateData = { status: "disputed", disputeReason: reason };
  }

  const updated = await prisma.settlement.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}