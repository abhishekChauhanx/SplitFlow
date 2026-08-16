import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const { title, amountPaise, dueDate, cycleMonth, subscribers } = await req.json();
  // subscribers: [{ name, email }]  — no phone, no userId from the client anymore

  try {
    const collection = await prisma.vendorCollection.create({
      data: {
        vendorId: vendor.id,
        title,
        amountPaise,
        dueDate: dueDate ? new Date(dueDate) : null,
        cycleMonth: cycleMonth || null,
        subscribers: {
          create: (subscribers || []).map((s: any) => ({
            name: s.name,
            invitedEmail: s.email || null,
            // userId intentionally omitted — stays null until claimed at login
          })),
        },
      },
      include: { subscribers: true },
    });

    return NextResponse.json(collection);
  } catch (err) {
    console.error("Create collection failed:", err);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const collections = await prisma.vendorCollection.findMany({
    where: { vendorId: vendor.id },
    include: { subscribers: { include: { payment: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(collections);
}