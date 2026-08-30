import { prisma } from "@/lib/prisma";

export async function generateGroupStatement(groupId: string, periodDays: number = 30) {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });
  if (!group) throw new Error("Group not found");

  const expenses = await prisma.expense.findMany({
    where: { groupId, createdAt: { gte: since } },
    include: { paidBy: true, splits: true },
    orderBy: { createdAt: "desc" },
  });

  const settlements = await prisma.settlement.findMany({
    where: { groupId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const userMap = Object.fromEntries(group.members.map((m) => [m.userId, m.user.name || m.user.email]));

  const totalSpent = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  const allExpenses = await prisma.expense.findMany({
    where: { groupId },
    include: { splits: true },
  });
  const net: Record<string, number> = {};
  for (const e of allExpenses) {
    net[e.paidById] = (net[e.paidById] || 0) + e.amountPaise;
    for (const s of e.splits) {
      net[s.userId] = (net[s.userId] || 0) - s.amountOwedPaise;
    }
  }

  // NEW — every settlement in this period, tagged with names and clear status
  const settlementsWithNames = settlements.map((s) => ({
    fromName: userMap[s.fromUserId] || "Unknown",
    toName: userMap[s.toUserId] || "Unknown",
    amountPaise: s.amountPaise,
    status: s.status, // "pending" | "payer_confirmed" | "both_confirmed" | "disputed"
    paymentMethod: s.paymentMethod,
    createdAt: s.createdAt,
  }));

  // NEW — from the simplified debt suggestions (who currently still needs to
  // pay whom), cross-referenced against settlements already confirmed, so we
  // can show a clean "still pending" list distinct from "already settled"
  const stillOwing = Object.entries(net)
    .filter(([, amountPaise]) => amountPaise < 0)
    .map(([userId, amountPaise]) => ({
      name: userMap[userId] || "Unknown",
      amountPaise: Math.abs(amountPaise),
    }));

  return {
    groupName: group.name,
    periodDays,
    periodStart: since,
    periodEnd: new Date(),
    totalSpentPaise: totalSpent,
    expenseCount: expenses.length,
    expenses: expenses.map((e) => ({
      description: e.description,
      amountPaise: e.amountPaise,
      paidByName: e.paidBy.name || e.paidBy.email,
      date: e.createdAt,
    })),
    settlementsInPeriod: settlements.length,
    settlementsConfirmed: settlements.filter((s) => s.status === "both_confirmed").length,
    settlements: settlementsWithNames, // NEW
    currentBalances: Object.entries(net).map(([userId, amountPaise]) => ({
      name: userMap[userId] || "Unknown",
      amountPaise,
    })),
    stillOwing, // NEW — quick "who still needs to pay" list
  };
}