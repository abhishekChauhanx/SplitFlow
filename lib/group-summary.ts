import { prisma } from "@/lib/prisma";

function paiseToRupees(paise: number) {
  return Math.round((paise / 100) * 100) / 100; // 2dp
}

export type GroupSummary = {
  totalGroupSpending: number; // ₹
  memberCount: number;
  expenseCount: number;
  activeSince: string | null; // ISO — group creation date
  lastActivity: string | null; // ISO — most recent expense/settlement
  settledAmount: number; // ₹
  pendingAmount: number; // ₹
  disputedAmount: number; // ₹
  biggestExpense: { description: string; amountPaise: number } | null;
  topSpender: { name: string; amountPaise: number } | null;
  averageExpenseSize: number; // ₹
};

export async function getGroupSummary(groupId: string): Promise<GroupSummary | null> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return null;

  const [
    memberCount,
    expenseAgg,
    paymentsByUser,
    legacyPaidByUser,
    settlements,
    biggestExpense,
    lastExpense,
    lastSettlement,
  ] = await Promise.all([
    prisma.groupMember.count({ where: { groupId } }),
    prisma.expense.aggregate({ where: { groupId }, _sum: { amountPaise: true }, _count: true }),
    prisma.expensePayment.groupBy({
      by: ["userId"],
      where: { expense: { groupId } },
      _sum: { amountPaise: true },
    }),
    // Legacy expenses created before ExpensePayment existed — fall back to paidById
    prisma.expense.groupBy({
      by: ["paidById"],
      where: { groupId, payments: { none: {} } },
      _sum: { amountPaise: true },
    }),
    prisma.settlement.findMany({ where: { groupId } }),
    prisma.expense.findFirst({ where: { groupId }, orderBy: { amountPaise: "desc" } }),
    prisma.expense.findFirst({ where: { groupId }, orderBy: { createdAt: "desc" } }),
    prisma.settlement.findFirst({ where: { groupId }, orderBy: { createdAt: "desc" } }),
  ]);

  // Merge per-user contribution totals (payments + legacy fallback) to find the top spender
  const totals = new Map<string, number>();
  for (const p of paymentsByUser) {
    totals.set(p.userId, (totals.get(p.userId) || 0) + (p._sum.amountPaise || 0));
  }
  for (const l of legacyPaidByUser) {
    totals.set(l.paidById, (totals.get(l.paidById) || 0) + (l._sum.amountPaise || 0));
  }

  let topSpender: { name: string; amountPaise: number } | null = null;
  if (totals.size > 0) {
    const [topUserId, topAmount] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    const user = await prisma.user.findUnique({ where: { id: topUserId } });
    topSpender = { name: user?.name || user?.email || "Unknown", amountPaise: topAmount };
  }

  let settledPaise = 0;
  let pendingPaise = 0;
  let disputedPaise = 0;
  for (const s of settlements) {
    if (s.status === "both_confirmed") settledPaise += s.amountPaise;
    else if (s.status === "disputed") disputedPaise += s.amountPaise;
    else pendingPaise += s.amountPaise;
  }

  const expenseCount = expenseAgg._count;
  const totalSpendingPaise = expenseAgg._sum.amountPaise || 0;

  const lastActivity = [lastExpense?.createdAt, lastSettlement?.createdAt]
    .filter(Boolean)
    .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;

  return {
    totalGroupSpending: paiseToRupees(totalSpendingPaise),
    memberCount,
    expenseCount,
    activeSince: group.createdAt.toISOString(),
    lastActivity: lastActivity ? lastActivity.toISOString() : null,
    settledAmount: paiseToRupees(settledPaise),
    pendingAmount: paiseToRupees(pendingPaise),
    disputedAmount: paiseToRupees(disputedPaise),
    biggestExpense: biggestExpense
      ? { description: biggestExpense.description, amountPaise: biggestExpense.amountPaise }
      : null,
    topSpender,
    averageExpenseSize: expenseCount > 0 ? paiseToRupees(totalSpendingPaise / expenseCount) : 0,
  };
}