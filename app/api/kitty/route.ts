import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { title, description, targetPaise, deadline, collectorUpiId, contributorUserIds } = await req.json();

  if (!title || !targetPaise || !contributorUserIds || contributorUserIds.length === 0) {
    return NextResponse.json({ error: "Title, target amount, and at least one contributor are required" }, { status: 400 });
  }

  // Default: split target equally among contributors (organizer can adjust individual amounts later)
  const perPersonPaise = Math.floor(targetPaise / contributorUserIds.length);
  const remainder = targetPaise - perPersonPaise * contributorUserIds.length;

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const kitty = await prisma.kitty.create({
    data: {
      title,
      description: description || null,
      targetPaise,
      organizerId: userId,
      deadline: deadline ? new Date(deadline) : null,
      collectorUpiId: collectorUpiId || user?.upiId || null,
      contributions: {
        create: contributorUserIds.map((uid: string, index: number) => ({
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

  // Kitties this user organized OR is a contributor in
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