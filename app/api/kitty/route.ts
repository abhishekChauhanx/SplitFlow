import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { title, description, targetPaise, deadline, collectorUpiId, contributorEmails } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!targetPaise || targetPaise <= 0) {
    return NextResponse.json({ error: "Target amount is required" }, { status: 400 });
  }
  if (!contributorEmails || contributorEmails.length === 0) {
    return NextResponse.json({ error: "Add at least one contributor's email" }, { status: 400 });
  }

  // Resolve each email to a real, existing user — kitty contributors must
  // have accounts (same as vendor subscribers), since contributions tie to userId.
  const normalizedEmails: string[] = contributorEmails.map((e: string) => e.trim().toLowerCase());
  const users = await prisma.user.findMany({
    where: { email: { in: normalizedEmails } },
  });

  const foundEmails = new Set(users.map((u) => u.email?.toLowerCase()));
  const notFound = normalizedEmails.filter((e) => !foundEmails.has(e));

  if (notFound.length > 0) {
    return NextResponse.json(
      { error: `No SplitFlow account found for: ${notFound.join(", ")}. They need to sign up first.` },
      { status: 400 }
    );
  }

  const contributorUserIds = users.map((u) => u.id);
  const perPersonPaise = Math.floor(targetPaise / contributorUserIds.length);
  const remainder = targetPaise - perPersonPaise * contributorUserIds.length;

  const organizer = await prisma.user.findUnique({ where: { id: userId } });

  const kitty = await prisma.kitty.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      targetPaise,
      organizerId: userId,
      deadline: deadline ? new Date(deadline) : null,
      collectorUpiId: collectorUpiId || organizer?.upiId || null,
      contributions: {
        create: contributorUserIds.map((uid, index) => ({
          userId: uid,
          amountPaise: index === contributorUserIds.length - 1 ? perPersonPaise + remainder : perPersonPaise,
        })),
      },
    },
    include: { contributions: true },
  });

  return NextResponse.json(kitty);
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitties = await prisma.kitty.findMany({
    where: {
      OR: [
        { organizerId: userId },
        { contributions: { some: { userId } } },
      ],
    },
    include: {
      contributions: true,
      expenses: true,
      organizer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(kitties);
}