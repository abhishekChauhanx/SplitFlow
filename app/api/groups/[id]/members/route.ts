import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { email } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No user with that email yet" }, { status: 404 });
  }

  try {
    await prisma.groupMember.create({
      data: { groupId: id, userId: user.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "This person is already in the group" }, { status: 409 });
    }
    console.error("Add member failed:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}