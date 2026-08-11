import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { sendPushToUser } from "@/lib/webpush";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ permissionId: string }> }
) {
  const { permissionId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const permission = await prisma.editPermission.findUnique({
    where: { id: permissionId },
    include: {
      requestedBy: { select: { name: true, email: true } },
      expense: { select: { description: true } },
    },
  });

  if (!permission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (permission.ownerId !== userId) {
    return NextResponse.json({ error: "Only the expense creator can approve this" }, { status: 403 });
  }

  const { decision } = await req.json(); // "approved" | "denied"
  const updated = await prisma.editPermission.update({
    where: { id: permissionId },
    data: { status: decision },
  });
await sendPushToUser(permission.requestedById, {
  title: decision === "approved" ? "Edit permission approved ✓" : "Edit permission denied",
  body: decision === "approved"
    ? `You can now edit "${permission.expense.description}"`
    : `Your request to edit "${permission.expense.description}" was declined`,
  url: `/groups/${permission.expense.groupId}`,
}).catch(() => {});
  return NextResponse.json(updated);
}