import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { expenseId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action } = await req.json();
  const requestedAction = action || "edit";

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { createdBy: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership now keyed on createdById, not paidById — see PATCH/DELETE route comment
  if (expense.createdById === userId) {
    return NextResponse.json({ approved: true, reason: "owner" });
  }

  const approved = await prisma.editPermission.findFirst({
    where: { expenseId, requestedById: userId, status: "approved", action: requestedAction },
  });
  if (approved) {
    return NextResponse.json({ approved: true, reason: "already_approved", permissionId: approved.id });
  }

  const pending = await prisma.editPermission.findFirst({
    where: { expenseId, requestedById: userId, status: "pending", action: requestedAction },
  });
  if (pending) {
    return NextResponse.json({ approved: false, permissionId: pending.id, status: "pending", reason: "already_pending" });
  }

  const permission = await prisma.editPermission.create({
    data: {
      expenseId,
      requestedById: userId,
      ownerId: expense.createdById,
      status: "pending",
      action: requestedAction,
    },
  });

  return NextResponse.json({ approved: false, permissionId: permission.id, status: "pending" });
}