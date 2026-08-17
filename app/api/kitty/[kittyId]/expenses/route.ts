import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kittyId: string }> }
) {
  const { kittyId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kitty = await prisma.kitty.findUnique({ where: { id: kittyId } });
  if (!kitty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (kitty.organizerId !== userId) {
    return NextResponse.json({ error: "Only the organizer can log spending from this kitty" }, { status: 403 });
  }

  const { description, amountPaise } = await req.json();
  if (!description || !amountPaise) {
    return NextResponse.json({ error: "Description and amount are required" }, { status: 400 });
  }

  const expense = await prisma.kittyExpense.create({
    data: { kittyId, description, amountPaise, spentById: userId },
  });

  return NextResponse.json(expense);
}