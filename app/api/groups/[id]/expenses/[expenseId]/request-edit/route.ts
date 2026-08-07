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

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { paidBy: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If you created (paid for) the expense, no permission needed
  if (expense.paidById === userId) {
    return NextResponse.json({ approved: true, reason: "owner" });
  }

  // Check if there's already an approved permission
  const existing = await prisma.editPermission.findFirst({
    where: { expenseId, requestedById: userId, status: "approved" },
  });
  if (existing) return NextResponse.json({ approved: true, reason: "already_approved" });

  // Create a pending permission request
  const permission = await prisma.editPermission.create({
    data: {
      expenseId,
      requestedById: userId,
      ownerId: expense.paidById,
      status: "pending",
      action: (await req.json()).action || "edit", // "edit" or "delete"
    },
  });

  return NextResponse.json({ approved: false, permissionId: permission.id, status: "pending" });
}