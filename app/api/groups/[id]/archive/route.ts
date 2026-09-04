import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

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
  if (!membership?.isAdmin) {
    return NextResponse.json({ error: "Only group admins can archive this group" }, { status: 403 });
  }

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.group.update({
    where: { id },
    data: {
      archived: !group.archived,
      archivedAt: !group.archived ? new Date() : null,
    },
  });

  return NextResponse.json({ ok: true, archived: updated.archived });
}