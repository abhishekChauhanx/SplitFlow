import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";
import { getUserNetBalance } from "@/lib/group-balance";

const SETTLED_THRESHOLD_PAISE = 1; // treat sub-paisa rounding as effectively zero

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getSessionUserId();
    const membership = await assertGroupMember(userId, groupId);

    const memberCount = await prisma.groupMember.count({ where: { groupId } });
    if (memberCount <= 1) {
      return NextResponse.json(
        { error: "You're the last member — archive the group instead of leaving it." },
        { status: 400 }
      );
    }

    const balance = await getUserNetBalance(groupId, userId!);
    if (Math.abs(balance) >= SETTLED_THRESHOLD_PAISE) {
      return NextResponse.json(
        {
          error:
            balance > 0
              ? `You're owed ₹${(balance / 100).toFixed(2)} in this group — settle up before leaving.`
              : `You owe ₹${(Math.abs(balance) / 100).toFixed(2)} in this group — settle up before leaving.`,
          balancePaise: balance,
        },
        { status: 409 }
      );
    }

    if (membership.isAdmin) {
      const otherAdmins = await prisma.groupMember.count({
        where: { groupId, isAdmin: true, userId: { not: userId! } },
      });
      if (otherAdmins === 0) {
        const nextInLine = await prisma.groupMember.findFirst({
          where: { groupId, userId: { not: userId! } },
          orderBy: { joinedAt: "asc" },
        });
        if (nextInLine) {
          await prisma.groupMember.update({
            where: { id: nextInLine.id },
            data: { isAdmin: true },
          });
        }
      }
    }

    await prisma.groupMember.delete({ where: { id: membership.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleGroupError(err);
  }
}