import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { generateRentReceiptPdf } from "@/lib/rent-receipt-pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const { receiptId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const receipt = await prisma.rentReceipt.findUnique({
    where: { id: receiptId },
    include: {
      tenant: { select: { name: true, email: true } },
      landlord: { select: { name: true, email: true } },
      vendorPayment: { select: { createdAt: true } },
    },
  });

  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (receipt.tenantId !== userId && receipt.landlordId !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const pdfBuffer = await generateRentReceiptPdf({
    receiptId: receipt.id,
    tenantName: receipt.tenant.name || receipt.tenant.email || "Tenant",
    landlordName: receipt.landlord.name || receipt.landlord.email || "Landlord",
    landlordPan: receipt.landlordPan,
    propertyAddress: receipt.propertyAddress,
    amountPaise: receipt.amountPaise,
    paymentPeriodFrom: receipt.paymentPeriodFrom,
    paymentPeriodTo: receipt.paymentPeriodTo,
    utrNumber: receipt.utrNumber,
    paidAt: receipt.vendorPayment.createdAt,
    signedAt: receipt.signedAt,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rent-receipt-${receipt.id}.pdf"`,
    },
  });
}