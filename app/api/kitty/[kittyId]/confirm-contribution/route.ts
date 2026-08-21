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
    return NextResponse.json({ error: "Only the organizer can confirm contributions" }, { status: 403 });
  }

  const { contributionId } = await req.json();

  const updated = await prisma.kittyContribution.update({
    where: { id: contributionId },
    data: { status: "confirmed", confirmedAt: new Date() },
  });

  return NextResponse.json(updated);
}