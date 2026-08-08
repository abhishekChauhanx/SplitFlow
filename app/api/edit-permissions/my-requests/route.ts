import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const expenseId = searchParams.get("expenseId");

  const where: any = { requestedById: userId };
  if (expenseId) where.expenseId = expenseId;

  const requests = await prisma.editPermission.findMany({
    where,
    include: {
      expense: { select: { id: true, description: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}