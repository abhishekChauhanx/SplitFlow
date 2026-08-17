import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { recalculateAndSaveTrustScore } from "@/lib/trust-score";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { utrNumber } = await req.json();

  // Basic format validation — UTR is exactly 12 uppercase alphanumeric chars
  if (!utrNumber || !/^[A-Z0-9]{12}$/i.test(utrNumber.trim())) {
    return NextResponse.json(
      { error: "UTR must be exactly 12 alphanumeric characters (e.g. HDFC000123456)" },
      { status: 400 }
    );
  }

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the payer (fromUserId) can submit their UTR
  if (settlement.fromUserId !== userId) {
    return NextResponse.json(
      { error: "Only the person who paid can add a UTR number" },
      { status: 403 }
    );
  }

  // Don't allow overwriting an existing UTR — prevents tampering
  if (settlement.utrNumber) {
    return NextResponse.json(
      { error: "A UTR number has already been saved for this settlement" },
      { status: 409 }
    );
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: { utrNumber: utrNumber.trim().toUpperCase() },
  });

  // Recalculate the payer's trust score — submitting a UTR raises their
  // UTR submission rate. Never blocks the response if scoring fails.
  await recalculateAndSaveTrustScore(settlement.fromUserId).catch(() => {});

  return NextResponse.json(updated);
}