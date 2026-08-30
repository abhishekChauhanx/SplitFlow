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

  // Net balances over the whole period, not just this window — same logic as getRawBalances
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
    currentBalances: Object.entries(net).map(([userId, amountPaise]) => ({
      name: userMap[userId] || "Unknown",
      amountPaise,
    })),
  };
}