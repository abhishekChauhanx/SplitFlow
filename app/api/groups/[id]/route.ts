import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: true } } },
  });
  return NextResponse.json(group);
}