import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const subscriptions = await prisma.vendorSubscriber.findMany({
    where: { userId },
    include: {
      collection: { include: { vendor: { select: { businessName: true } } } },
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subscriptions);
}