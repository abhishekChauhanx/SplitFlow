import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: { group: true },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  if (new Date() > invite.expiresAt) return NextResponse.json({ error: "This invite has expired" }, { status: 410 });

  return NextResponse.json({ groupName: invite.group.name, groupId: invite.groupId });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: { group: true },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  if (new Date() > invite.expiresAt) return NextResponse.json({ error: "This invite has expired" }, { status: 410 });

  // Already a member — return 409 with the groupId so we can redirect them
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invite.groupId, userId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "already_member", groupId: invite.groupId },
      { status: 409 }
    );
  }

  await prisma.groupMember.create({
    data: { groupId: invite.groupId, userId },
  });

  await prisma.groupInvite.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ groupId: invite.groupId, groupName: invite.group.name });
}