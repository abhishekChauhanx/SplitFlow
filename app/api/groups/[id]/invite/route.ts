import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await prisma.groupInvite.create({
    data: { groupId: id, expiresAt },
  });

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/join/${invite.token}`;
  return NextResponse.json({ link, expiresAt });
}