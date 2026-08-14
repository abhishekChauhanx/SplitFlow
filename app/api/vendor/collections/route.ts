import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const { title, amountPaise, dueDate, cycleMonth, subscribers } = await req.json();
  if (!title || !amountPaise) {
    return NextResponse.json({ error: "Title and amount are required" }, { status: 400 });
  }

  const cleaned = (subscribers || [])
    .map((s: any) => ({
      name: s.name?.trim(),
      email: s.email?.trim().toLowerCase() || null,
      phone: s.phone?.trim() || null,
      userId: s.userId || null,
    }))
    .filter((s: any) => s.name);

  const emails = cleaned.filter((s) => s.email).map((s) => s.email);
  const dupe = emails.find((e, i) => emails.indexOf(e) !== i);
  if (dupe) {
    return NextResponse.json({ error: `Duplicate email in subscriber list: ${dupe}` }, { status: 400 });
  }

  try {
    const collection = await prisma.vendorCollection.create({
      data: {
        vendorId: vendor.id,
        title,
        amountPaise,
        dueDate: dueDate ? new Date(dueDate) : null,
        cycleMonth: cycleMonth || null,
        subscribers: { create: cleaned },
      },
      include: { subscribers: true },
    });
    return NextResponse.json(collection);
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Duplicate email in subscriber list" }, { status: 409 });
    }
    throw e;
  }
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const collections = await prisma.vendorCollection.findMany({
    where: { vendorId: vendor.id },
    include: {
      subscribers: { include: { payment: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(collections);
}