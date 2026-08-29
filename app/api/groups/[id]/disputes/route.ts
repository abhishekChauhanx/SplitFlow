import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId } },
  });
  if (!membership?.isAdmin) {
    return NextResponse.json({ error: "Only group admins can view disputes" }, { status: 403 });
  }

  const disputes = await prisma.settlement.findMany({
    where: { groupId: id, status: "disputed", arbitratedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const userIds = [...new Set(disputes.flatMap((d) => [d.fromUserId, d.toUserId]))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]));

  return NextResponse.json(
    disputes.map((d) => ({
      ...d,
      fromName: userMap[d.fromUserId],
      toName: userMap[d.toUserId],
    }))
  );
}