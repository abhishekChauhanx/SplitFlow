import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: { members: { include: { user: true } } },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, groupType, propertyAddress } = await req.json();

  const group = await prisma.group.create({
    data: {
      name,
      groupType: groupType === "rent" ? "rent" : "trip",
      propertyAddress: groupType === "rent" ? propertyAddress || null : null,
      members: { create: { userId } },
    },
  });
  return NextResponse.json(group);
}