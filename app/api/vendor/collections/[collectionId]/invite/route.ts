import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const collection = await prisma.vendorCollection.findUnique({
    where: { id: collectionId },
  });

  if (!collection || collection.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${collection.token}`;

  return NextResponse.json({
    link,
    openEnrollment: collection.openEnrollment,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const collection = await prisma.vendorCollection.findUnique({
    where: { id: collectionId },
  });

  if (!collection || collection.vendorId !== vendor.id) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Toggle whether new/unknown people can join via this link, or only
  // subscribers the vendor has already pre-added
  const { openEnrollment } = await req.json();

  const updated = await prisma.vendorCollection.update({
    where: { id: collectionId },
    data: { openEnrollment: !!openEnrollment },
  });

  const link = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${collection.token}`;

  return NextResponse.json({
    link,
    openEnrollment: updated.openEnrollment,
  });
}