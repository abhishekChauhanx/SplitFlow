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

  const template = await prisma.recurringTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Toggle: if active → pause, if paused → resume
  const isPausing = template.active;

  const updated = await prisma.recurringTemplate.update({
    where: { id: templateId },
    data: {
      active: !template.active,
      pausedAt: isPausing ? new Date() : null,
    },
  });

  return NextResponse.json({
    ok: true,
    active: updated.active,
    pausedAt: updated.pausedAt,
    message: isPausing ? "Template paused" : "Template resumed",
  });
}