import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { calculateRefunds } from "@/lib/kitty-logic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kittyId: string }> }
) {
  const { kittyId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({
    where: { id: kittyId },
    include: { contributions: true, expenses: true },
  });
  if (!kitty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (kitty.organizerId !== userId) {
    return NextResponse.json({ error: "Only the organizer can close this kitty" }, { status: 403 });
  }
  if (kitty.status !== "collecting") {
    return NextResponse.json({ error: "This kitty is already closed" }, { status: 400 });
  }

  const paidContributions = kitty.contributions.filter((c) => c.paidAmountPaise);
  const totalCollected = paidContributions.reduce((sum, c) => sum + (c.paidAmountPaise || 0), 0);
  const totalSpent = kitty.expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const leftover = totalCollected - totalSpent;

  const refunds = calculateRefunds(
    paidContributions.map((c) => ({ userId: c.userId, paidAmountPaise: c.paidAmountPaise! })),
    leftover
  );

  // Save refund amounts per contributor
  await Promise.all(
    refunds.map((r) =>
      prisma.kittyContribution.update({
        where: { kittyId_userId: { kittyId, userId: r.userId } },
        data: {
          refundPaise: r.refundPaise,
          refundStatus: r.refundPaise > 0 ? "pending" : null,
        },
      })
    )
  );

  const updated = await prisma.kitty.update({
    where: { id: kittyId },
    data: { status: leftover > 0 ? "refunded" : "closed", closedAt: new Date() },
  });

  return NextResponse.json({ kitty: updated, leftover, refunds });
}