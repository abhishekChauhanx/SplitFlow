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

  // Block edits if a settlement is already confirmed for this group
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const confirmedSettlement = await prisma.settlement.findFirst({
    where: { groupId: expense.groupId, status: "both_confirmed" },
  });
  if (confirmedSettlement) {
    return NextResponse.json(
      { error: "Can't edit expenses after a settlement has been confirmed in this group" },
      { status: 409 }
    );
  }

  const { description, amountPaise, paidById } = await req.json();
  const members = await prisma.groupMember.findMany({ where: { groupId: expense.groupId } });
  const memberIds = members.map((m) => m.userId);
  const splits = splitEqual(amountPaise, memberIds, paidById);

  // Delete old splits and recreate with new amounts
  await prisma.expenseSplit.deleteMany({ where: { expenseId } });
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      description,
      amountPaise,
      paidById,
      splits: { create: splits },
    },
    include: { splits: true },
  });

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

  const confirmedSettlement = await prisma.settlement.findFirst({
    where: { groupId: expense.groupId, status: "both_confirmed" },
  });
  if (confirmedSettlement) {
    return NextResponse.json(
      { error: "Can't delete expenses after a settlement has been confirmed in this group" },
      { status: 409 }
    );
  }

  // Delete splits first (foreign key), then the expense
  await prisma.expenseSplit.deleteMany({ where: { expenseId } });
  await prisma.expense.delete({ where: { id: expenseId } });

  return NextResponse.json({ ok: true });
}