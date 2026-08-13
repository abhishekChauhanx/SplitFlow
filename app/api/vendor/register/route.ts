import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { businessName, businessType, upiId, panNumber } = await req.json();

  if (!businessName || !businessType) {
    return NextResponse.json({ error: "Business name and type are required" }, { status: 400 });
  }

  // Update user role to vendor
  await prisma.user.update({
    where: { id: userId },
    data: { role: "vendor" },
  });

  // Create vendor profile
  const vendor = await prisma.vendor.upsert({
    where: { userId },
    update: { businessName, businessType, upiId, panNumber },
    create: { userId, businessName, businessType, upiId, panNumber },
  });

  return NextResponse.json(vendor);
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    include: {
      collections: {
        include: {
          subscribers: { include: { payment: true } },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(vendor);
}