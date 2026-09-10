import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId } },
      ...(includeArchived ? {} : { archived: false }),
    },
    include: { members: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { name, groupType } = await req.json();

  const group = await prisma.group.create({
    data: {
      name,
      groupType: groupType === "rent" ? "rent" : "trip",
      members: {
        create: { userId, isAdmin: true }, // creator is admin by default
      },
    },
  });
  return NextResponse.json(group);
}