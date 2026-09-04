import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { getRawBalances } from "@/lib/balances";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId } },
  });
  if (!membership) return NextResponse.json({ error: "You're not a member of this group" }, { status: 404 });

  // Block leaving with an outstanding balance in either direction —
  // otherwise the group's math silently breaks for everyone left behind.
  const net = await getRawBalances(id);
  const myBalance = net[userId] || 0;

  if (myBalance !== 0) {
    return NextResponse.json(
      {
        error: "balance_not_settled",
        message:
          myBalance > 0
            ? `You're owed ₹${(myBalance / 100).toFixed(2)} in this group — settle up before leaving.`
            : `You owe ₹${(Math.abs(myBalance) / 100).toFixed(2)} in this group — settle up before leaving.`,
        balancePaise: myBalance,
      },
      { status: 409 }
    );
  }

  const allMembers = await prisma.groupMember.findMany({ where: { groupId: id } });

  // Last person in the group — leaving just leaves an empty group behind,
  // which is fine, no special handling needed beyond removing the row.
  if (allMembers.length === 1) {
    await prisma.groupMember.delete({ where: { id: membership.id } });
    return NextResponse.json({ ok: true, wasLastMember: true });
  }

  // If the leaving member is the group's only admin, promote the
  // next-longest-standing member so the group never ends up with zero admins.
  if (membership.isAdmin) {
    const otherMembers = allMembers.filter((m) => m.userId !== userId);
    const anotherAdminExists = otherMembers.some((m) => m.isAdmin);

    if (!anotherAdminExists) {
      const nextAdmin = otherMembers.sort(
        (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
      )[0];
      await prisma.groupMember.update({
        where: { id: nextAdmin.id },
        data: { isAdmin: true },
      });
    }
  }

  await prisma.groupMember.delete({ where: { id: membership.id } });

  return NextResponse.json({ ok: true, wasLastMember: false });
}