import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const templates = await prisma.recurringTemplate.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { description, amountPaise, splitType, shareUnits, frequencyDays } = await req.json();

  const template = await prisma.recurringTemplate.create({
    data: {
      groupId: id,
      description,
      amountPaise,
      splitType,
      shareUnits: splitType === "SHARES" ? shareUnits : undefined,
      frequencyDays,
      nextRunAt: new Date(), // first run is immediate; can be changed to a future date if preferred
    },
  });

  return NextResponse.json(template);
}