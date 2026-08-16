import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const { receiptId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const receipt = await prisma.rentReceipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (receipt.landlordId !== userId) {
    return NextResponse.json({ error: "Only the landlord can sign this receipt" }, { status: 403 });
  }

  if (receipt.status === "signed") {
    return NextResponse.json(receipt);
  }

  const updated = await prisma.rentReceipt.update({
    where: { id: receiptId },
    data: { status: "signed", signedAt: new Date() },
  });

  return NextResponse.json(updated);
}