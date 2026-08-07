import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { splitEqual } from "@/lib/split-logic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { expenseId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permission check: owner can edit freely, others need an approved permission
  if (expense.paidById !== userId) {
    const permission = await prisma.editPermission.findFirst({
      where: {
        expenseId,
        requestedById: userId,
        status: "approved",
        action: "edit",
      },
    });
    if (!permission) {
      return NextResponse.json(
        { error: "permission_required", message: "You need permission from the expense creator to do this" },
        { status: 403 }
      );
    }
  }

  const confirmedSettlement = await prisma.settlement.findFirst({
    where: { groupId: expense.groupId, status: "both_confirmed" },
  });
  if (confirmedSettlement) {
    return NextResponse.json(
      { error: "Can't edit expenses after a settlement has been confirmed" },
      { status: 409 }
    );
  }

  const { description, amountPaise, paidById } = await req.json();
  const members = await prisma.groupMember.findMany({ where: { groupId: expense.groupId } });
  const memberIds = members.map((m) => m.userId);
  const splits = splitEqual(amountPaise, memberIds, paidById);

  await prisma.expenseSplit.deleteMany({ where: { expenseId } });
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { description, amountPaise, paidById, splits: { create: splits } },
    include: { splits: true },
  });

  // Once the requester's edit is used, close out that approved permission
  // so a stale "approved" row doesn't silently grant future edits forever.
  if (expense.paidById !== userId) {
    await prisma.editPermission.updateMany({
      where: { expenseId, requestedById: userId, status: "approved", action: "edit" },
      data: { status: "used" },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { expenseId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permission check: owner can delete freely, others need an approved permission
  if (expense.paidById !== userId) {
    const permission = await prisma.editPermission.findFirst({
      where: {
        expenseId,
        requestedById: userId,
        status: "approved",
        action: "delete",
      },
    });
    if (!permission) {
      return NextResponse.json(
        { error: "permission_required", message: "You need permission from the expense creator to do this" },
        { status: 403 }
      );
    }
  }

  const confirmedSettlement = await prisma.settlement.findFirst({
    where: { groupId: expense.groupId, status: "both_confirmed" },
  });
  if (confirmedSettlement) {
    return NextResponse.json(
      { error: "Can't delete expenses after a settlement has been confirmed" },
      { status: 409 }
    );
  }

  await prisma.expenseSplit.deleteMany({ where: { expenseId } });
  await prisma.editPermission.deleteMany({ where: { expenseId } });
  await prisma.expense.delete({ where: { id: expenseId } });
  return NextResponse.json({ ok: true });
}