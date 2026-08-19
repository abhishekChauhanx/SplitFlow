import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const userId = await getSessionUserId();

  const kitty = await prisma.kitty.findUnique({
    where: { token },
    include: {
      contributions: true,
      organizer: { select: { name: true } },
    },
  });

  if (!kitty) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });

  const myContribution = userId
    ? kitty.contributions.find((c) => c.userId === userId)
    : null;

  return NextResponse.json({
    kittyId: kitty.id,
    title: kitty.title,
    description: kitty.description,
    targetPaise: kitty.targetPaise,
    deadline: kitty.deadline,
    status: kitty.status,
    organizerName: kitty.organizer.name,
    collectorUpiId: kitty.collectorUpiId,
    contributorCount: kitty.contributions.length,
    paidCount: kitty.contributions.filter((c) => c.status === "paid" || c.status === "confirmed").length,
    myAmountPaise: myContribution?.amountPaise ?? null, // if already a contributor, show their assigned share
    myStatus: myContribution?.status ?? null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({
    where: { token },
    include: { contributions: true },
  });
  if (!kitty) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  if (kitty.status !== "collecting") {
    return NextResponse.json({ error: "This kitty is no longer accepting contributions" }, { status: 400 });
  }

  const { amountPaise, paymentMethod, utrNumber } = await req.json();

  // Find existing contribution, or auto-add this user as a new contributor —
  // this is the "anyone with the link can join and contribute" behavior.
  let contribution = kitty.contributions.find((c) => c.userId === userId);

  if (!contribution) {
    contribution = await prisma.kittyContribution.create({
      data: {
        kittyId: kitty.id,
        userId,
        // No pre-assigned share for someone who joined via open link —
        // they specify what they're contributing themselves.
        amountPaise: amountPaise || 0,
      },
    });
  }

  if (contribution.status !== "pending") {
    return NextResponse.json({ error: "You've already contributed to this kitty" }, { status: 409 });
  }

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

  return NextResponse.json({ ok: true, contribution: updated });
}