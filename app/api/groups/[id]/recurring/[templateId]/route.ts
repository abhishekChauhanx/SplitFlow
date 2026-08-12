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
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
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

  await prisma.recurringTemplate.delete({ where: { id: templateId } });
  return NextResponse.json({ ok: true });
}