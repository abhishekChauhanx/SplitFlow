import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ permissionId: string }> }
) {
  const { permissionId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const permission = await prisma.editPermission.findUnique({ where: { id: permissionId } });
  if (!permission) return NextResponse.json({ ok: true }); // already gone — nothing to do
  if (permission.requestedById !== userId) {
    return NextResponse.json({ error: "Not your request" }, { status: 403 });
  }

  if (permission.status === "denied") {
    // Nothing more to track — delete so it stops showing up and the requester can try again
    await prisma.editPermission.delete({ where: { id: permissionId } });
  } else if (permission.status === "approved") {
    // Keep the row (it still grants edit rights) but stop re-alerting about it
    await prisma.editPermission.update({ where: { id: permissionId }, data: { notified: true } });
  }

  return NextResponse.json({ ok: true });
}