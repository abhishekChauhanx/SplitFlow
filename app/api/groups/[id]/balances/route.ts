import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRawBalances } from "@/lib/balances";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const net = await getRawBalances(id);
  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    include: { user: true },
  });

  const balances = members.map((m) => ({
    userId: m.userId,
    name: m.user.name || m.user.email,
    netPaise: net[m.userId] || 0,
  }));

  return NextResponse.json(balances);
}