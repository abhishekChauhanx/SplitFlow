import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const userId = await getUserId();

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, groupId: true, senderId: true },
    });
    if (!message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await assertGroupMember(userId, message.groupId);

    if (message.senderId !== userId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: "" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleGroupError(err);
  }
}