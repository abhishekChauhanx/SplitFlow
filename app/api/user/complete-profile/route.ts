import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name, phone, upiId } = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: { name, phone, upiId },
  });

  return NextResponse.json({ ok: true });
}