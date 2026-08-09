import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");

  const where: any = { requestedById: userId };
  if (groupId) where.expense = { groupId };

  const requests = await prisma.editPermission.findMany({
    where,
    include: {
      expense: { select: { id: true, description: true, groupId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}