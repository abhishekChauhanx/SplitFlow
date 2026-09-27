import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getSessionUserId();
    const membership = await assertGroupMember(userId, groupId);

    if (!membership.isAdmin) {
      return NextResponse.json({ error: "Only a group admin can archive this group." }, { status: 403 });
    }

    const { archived } = await req.json();

    const group = await prisma.group.update({
      where: { id: groupId },
      data: { archivedAt: archived ? new Date() : null },
    });

    return NextResponse.json(group);
  } catch (err) {
    return handleGroupError(err);
  }
}