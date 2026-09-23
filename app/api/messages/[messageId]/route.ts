import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const userId = await getSessionUserId();

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const userId = await getSessionUserId();

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, groupId: true, senderId: true, deletedAt: true },
    });
    if (!message || message.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await assertGroupMember(userId, message.groupId);
    if (message.senderId !== userId) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { body } = await req.json();
    const trimmed = (body ?? "").trim();
    if (!trimmed) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { body: trimmed, editedAt: new Date() },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleGroupError(err);
  }
}