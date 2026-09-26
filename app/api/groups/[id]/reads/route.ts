import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getSessionUserId();
    await assertGroupMember(userId, groupId);

    const reads = await prisma.messageRead.findMany({
      where: { groupId },
      select: { userId: true, lastReadAt: true },
    });

    return NextResponse.json(reads);
  } catch (err) {
    return handleGroupError(err);
  }
}