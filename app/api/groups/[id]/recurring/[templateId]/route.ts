import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { templateId } = await params;
  const template = await prisma.recurringTemplate.findUnique({
    where: { id: templateId },
    include: { _count: { select: { generatedExpenses: true } } },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { _count, ...rest } = template;
  return NextResponse.json({ ...rest, generatedExpenseCount: _count.generatedExpenses });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const {
    description,
    amountPaise,
    splitType,
    shareUnits,
    frequencyDays,
    nextRunAt,
  } = body;

  const updated = await prisma.recurringTemplate.update({
    where: { id: templateId },
    data: {
      ...(description !== undefined && { description }),
      ...(amountPaise !== undefined && { amountPaise }),
      ...(splitType !== undefined && { splitType }),
      ...(shareUnits !== undefined && { shareUnits }),
      ...(frequencyDays !== undefined && { frequencyDays }),
      ...(nextRunAt !== undefined && { nextRunAt: new Date(nextRunAt) }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const deleteGenerated = body?.deleteGenerated === true;

  let deletedExpenseCount = 0;

  if (deleteGenerated) {
    const { count } = await prisma.expense.deleteMany({
      where: { recurringTemplateId: templateId },
    });
    deletedExpenseCount = count;
  }

  await prisma.recurringTemplate.delete({ where: { id: templateId } });

  return NextResponse.json({ ok: true, deletedExpenseCount });
}