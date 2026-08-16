import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const asTenant = await prisma.rentReceipt.findMany({
    where: { tenantId: userId },
    include: {
      landlord: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const asLandlord = await prisma.rentReceipt.findMany({
    where: { landlordId: userId },
    include: {
      tenant: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ asTenant, asLandlord });
}