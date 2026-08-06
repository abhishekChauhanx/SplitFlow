import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, phone } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Create a placeholder user — no email, no auth, just a name for tracking
  const placeholder = await prisma.user.create({
    data: { name, phone: phone || null, isPlaceholder: true },
  });

  await prisma.groupMember.create({
    data: { groupId: id, userId: placeholder.id },
  });

  return NextResponse.json(placeholder);
}