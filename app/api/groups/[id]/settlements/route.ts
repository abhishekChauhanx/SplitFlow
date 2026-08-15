import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRawBalances } from "@/lib/balances";
import { simplifyDebts } from "@/lib/debt-simplify";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.group.findUnique({ where: { id }, select: { groupType: true } });

  const net = await getRawBalances(id);
  const transactions = simplifyDebts(net);

  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    include: { user: true },
  });
  const userMap = Object.fromEntries(members.map((m) => [m.userId, m.user]));

  const suggestions = transactions.map((t) => ({
    fromUserId: t.fromUserId,
    fromName: userMap[t.fromUserId]?.name || userMap[t.fromUserId]?.email,
    toUserId: t.toUserId,
    toName: userMap[t.toUserId]?.name || userMap[t.toUserId]?.email,
    toUpiId: userMap[t.toUserId]?.upiId || null,
    amountPaise: t.amountPaise,
    groupType: group?.groupType || "trip", // NEW — carried on every suggestion
  }));

  return NextResponse.json(suggestions);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { toUserId, amountPaise, paymentMethod } = await req.json();

  if (userId === toUserId) {
    return NextResponse.json({ error: "You can't record a payment to yourself" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settlement = await prisma.settlement.create({
    data: {
      groupId: id,
      fromUserId: userId,
      toUserId,
      amountPaise,
      paymentMethod: paymentMethod === "cash" ? "cash" : "upi",
      status: "pending",
    },
  });

  return NextResponse.json(settlement);
}