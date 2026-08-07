import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const requests = await prisma.editPermission.findMany({
    where: { ownerId: userId, status: "pending" },
    include: {
      expense: { select: { id: true, description: true, amountPaise: true } },
      requestedBy: { select: { id: true, name: true } }, // adjust field name to your User model
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}