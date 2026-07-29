import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { splitEqual } from "@/lib/split-logic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const expenses = await prisma.expense.findMany({
    where: { groupId: params.id },
    include: { paidBy: true, splits: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { description, amountPaise, paidById, confirmDuplicate } = await req.json();

  // Duplicate check: same group, amount, payer, description within the last 2 minutes
  if (!confirmDuplicate) {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const possibleDuplicate = await prisma.expense.findFirst({
      where: {
        groupId: params.id,
        amountPaise,
        paidById,
        description,
        createdAt: { gte: twoMinAgo },
      },
    });
    if (possibleDuplicate) {
      return NextResponse.json({ warning: "duplicate", message: "A very similar expense was just added. Add anyway?" }, { status: 409 });
    }
  }

  const members = await prisma.groupMember.findMany({ where: { groupId: params.id } });
  const memberIds = members.map((m) => m.userId);
  const splits = splitEqual(amountPaise, memberIds, paidById);

  const expense = await prisma.expense.create({
    data: {
      groupId: params.id,
      description,
      amountPaise,
      paidById,
      splitType: "EQUAL",
      splits: { create: splits },
    },
    include: { splits: true },
  });

  return NextResponse.json(expense);
}