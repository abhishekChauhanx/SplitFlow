import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const {
    amountPaise,      // override amount for next cycle only
    shareUnits,       // override share units for next cycle only
    excludeUserIds,   // members to exclude from next cycle (e.g. someone who left mid-month)
    note,             // reason for the proration
  } = await req.json();

  const template = await prisma.recurringTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Store override as JSON — cron job reads this before using template defaults
  const updated = await prisma.recurringTemplate.update({
    where: { id: templateId },
    data: {
      nextCycleOverride: {
        amountPaise: amountPaise ?? template.amountPaise,
        shareUnits: shareUnits ?? template.shareUnits,
        excludeUserIds: excludeUserIds ?? [],
        note: note || "Manual proration",
      },
    },
  });

  return NextResponse.json({ ok: true, nextCycleOverride: updated.nextCycleOverride });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  // Clear override without triggering a run
  const { templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const updated = await prisma.recurringTemplate.update({
    where: { id: templateId },
    data: { nextCycleOverride: null },
  });

  return NextResponse.json({ ok: true });
}