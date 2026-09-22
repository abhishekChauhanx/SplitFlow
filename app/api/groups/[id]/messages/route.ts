import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { assertGroupMember, handleGroupError } from "@/lib/group-auth";

const MAX_BODY = 2000;
const PAGE_SIZE = 50;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getSessionUserId();
    await assertGroupMember(userId, groupId);

    const { searchParams } = new URL(req.url);
    const before = searchParams.get("before");

    const messages = await prisma.message.findMany({
      where: {
        groupId,
        ...(before
          ? {
              createdAt: {
                lt: (
                  await prisma.message.findUnique({
                    where: { id: before },
                    select: { createdAt: true },
                  })
                )?.createdAt,
              },
            }
          : {}),
      },
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    });

    return NextResponse.json(messages.reverse()); // oldest-first for rendering
  } catch (err) {
    return handleGroupError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;
    const userId = await getSessionUserId();
    await assertGroupMember(userId, groupId);

    const { body, clientId } = await req.json();
    const trimmed = (body ?? "").trim();

    if (!trimmed) {
      return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    }
    if (trimmed.length > MAX_BODY) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_BODY} characters)` },
        { status: 400 }
      );
    }
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }

    // clientId is unique — a retried send returns the original row instead
    // of creating a duplicate
    const existing = await prisma.message.findUnique({
      where: { clientId },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });
    if (existing) return NextResponse.json(existing);

    const message = await prisma.message.create({
      data: { groupId, senderId: userId!, body: trimmed, clientId },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(message);
  } catch (err) {
    return handleGroupError(err);
  }
}