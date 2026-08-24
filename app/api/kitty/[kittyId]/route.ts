import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kittyId: string }> }
) {
  const { kittyId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({
    where: { id: kittyId },
    include: {
      contributions: { include: { user: { select: { name: true, email: true } } } },
      expenses: { include: { spentBy: { select: { name: true, email: true } } } },
      organizer: { select: { name: true, email: true } },
    },
  });

  if (!kitty) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember =
    kitty.organizerId === userId || kitty.contributions.some((c) => c.userId === userId);
  if (!isMember) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const totalCollected = kitty.contributions
    .filter((c) => c.status === "paid" || c.status === "confirmed")
    .reduce((sum, c) => sum + (c.paidAmountPaise || 0), 0);

  const totalSpent = kitty.expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  return NextResponse.json({
    ...kitty,
    totalCollected,
    totalSpent,
    remaining: totalCollected - totalSpent,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ kittyId: string }> }
) {
  const { kittyId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({ where: { id: kittyId } });
  if (!kitty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (kitty.organizerId !== userId) {
    return NextResponse.json({ error: "Only the organizer can edit this kitty" }, { status: 403 });
  }
  if (kitty.status !== "collecting") {
    return NextResponse.json({ error: "Can't edit a closed kitty" }, { status: 400 });
  }

  const { title, description, targetPaise, deadline, collectorUpiId } = await req.json();

  const updated = await prisma.kitty.update({
    where: { id: kittyId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(targetPaise !== undefined && { targetPaise }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(collectorUpiId !== undefined && { collectorUpiId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ kittyId: string }> }
) {
  const { kittyId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({
    where: { id: kittyId },
    include: { contributions: true },
  });
  if (!kitty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (kitty.organizerId !== userId) {
    return NextResponse.json({ error: "Only the organizer can delete this kitty" }, { status: 403 });
  }

  const hasAnyPaid = kitty.contributions.some((c) => c.status === "paid" || c.status === "confirmed");
  if (hasAnyPaid) {
    return NextResponse.json(
      { error: "Can't delete — some contributions have already been paid" },
      { status: 409 }
    );
  }

  await prisma.kittyExpense.deleteMany({ where: { kittyId } });
  await prisma.kittyContribution.deleteMany({ where: { kittyId } });
  await prisma.kitty.delete({ where: { id: kittyId } });

  return NextResponse.json({ ok: true });
}