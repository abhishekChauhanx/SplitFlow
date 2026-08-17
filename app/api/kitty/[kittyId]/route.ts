import { NextResponse } from "next/server";
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