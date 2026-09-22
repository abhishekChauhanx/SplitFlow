import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getUserId();
    await assertGroupMember(userId, groupId);

    await prisma.messageRead.upsert({
      where: { userId_groupId: { userId: userId!, groupId } },
      create: { userId: userId!, groupId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleGroupError(err);
  }
}