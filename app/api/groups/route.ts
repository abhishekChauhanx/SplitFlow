import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || "active"; // "active" | "archived" | "all"

  const archivedFilter =
    status === "archived" ? { archivedAt: { not: null } }
    : status === "all" ? {}
    : { archivedAt: null }; // "active" — default, matches current behavior

  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId } },
      ...archivedFilter,
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
        create: { userId, isAdmin: true },
      },
    },
  });
  return NextResponse.json(group);
}