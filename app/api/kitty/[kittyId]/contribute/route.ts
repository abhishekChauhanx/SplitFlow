import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kittyId: string }> }
) {
  const { kittyId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({ where: { id: kittyId } });
  if (!kitty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (kitty.status !== "collecting") {
    return NextResponse.json({ error: "This kitty is no longer accepting contributions" }, { status: 400 });
  }

  const contribution = await prisma.kittyContribution.findUnique({
    where: { kittyId_userId: { kittyId, userId } },
  });
  if (!contribution) {
    return NextResponse.json({ error: "You're not a contributor on this kitty" }, { status: 403 });
  }
  if (contribution.status !== "pending") {
    return NextResponse.json({ error: "You've already contributed" }, { status: 409 });
  }

  const { amountPaise, paymentMethod, utrNumber } = await req.json();

  const updated = await prisma.kittyContribution.update({
    where: { id: contribution.id },
    data: {
      paidAmountPaise: amountPaise || contribution.amountPaise,
      paymentMethod: paymentMethod === "cash" ? "cash" : "upi",
      utrNumber: utrNumber || null,
      status: "paid",
      paidAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}