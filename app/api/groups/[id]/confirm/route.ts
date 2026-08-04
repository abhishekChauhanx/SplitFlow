import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settlement = await prisma.settlement.update({
    where: { id },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
  return NextResponse.json(settlement);
}