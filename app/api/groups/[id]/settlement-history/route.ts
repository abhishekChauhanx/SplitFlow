import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.group.findUnique({ where: { id }, select: { groupType: true } });

  const settlements = await prisma.settlement.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "desc" },
  });

  const userIds = [...new Set(settlements.flatMap((s) => [s.fromUserId, s.toUserId]))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]));

  const history = settlements.map((s) => ({
    ...s,
    fromName: userMap[s.fromUserId],
    toName: userMap[s.toUserId],
    groupType: group?.groupType || "trip", // NEW
  }));

  return NextResponse.json(history);
}