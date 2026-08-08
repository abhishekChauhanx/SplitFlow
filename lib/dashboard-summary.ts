import { prisma } from "@/lib/prisma";
import { getRawBalances } from "@/lib/balances";

export type GroupSummaryRow = {
  groupId: string;
  groupName: string;
  myRole: "Creator" | "Member";
  totalMembers: number;
  groupTotalSpending: number; // ₹
  iPaid: number; // ₹
  myFairShare: number; // ₹
  owedToMe: number; // ₹
  iStillOwe: number; // ₹
  settledAmount: number; // ₹
  pendingAmount: number; // ₹
  disputedAmount: number; // ₹
  totalExpenses: number;
  lastActivity: string | null; // ISO date string, or null if no activity yet
};

function paiseToRupees(paise: number) {
  return Math.round((paise / 100) * 100) / 100; // 2dp
}

export async function getDashboardGroupSummaries(userId: string): Promise<GroupSummaryRow[]> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: true },
  });

  const rows = await Promise.all(
    memberships.map(async (membership) => {
      const groupId = membership.groupId;

      // "Creator" is approximated as whoever joined the group first — the schema
      // doesn't track an explicit creator field. If you add one later, swap this out.
      const earliestMember = await prisma.groupMember.findFirst({
        where: { groupId },
        orderBy: { joinedAt: "asc" },
      });
      const myRole: "Creator" | "Member" = earliestMember?.userId === userId ? "Creator" : "Member";

      const [
        totalMembers,
        expenseAgg,
        myPayments,
        legacyPaidByMe,
        myShareAgg,
        net,
        settlements,
        lastExpense,
        lastSettlement,
      ] = await Promise.all([
        prisma.groupMember.count({ where: { groupId } }),
        prisma.expense.aggregate({
          where: { groupId },
          _sum: { amountPaise: true },
          _count: true,
        }),
        prisma.expensePayment.aggregate({
          where: { userId, expense: { groupId } },
          _sum: { amountPaise: true },
        }),
        prisma.expense.aggregate({
          where: { groupId, paidById: userId, payments: { none: {} } },
          _sum: { amountPaise: true },
        }),
        prisma.expenseSplit.aggregate({
          where: { userId, expense: { groupId } },
          _sum: { amountOwedPaise: true },
        }),
        getRawBalances(groupId),
        prisma.settlement.findMany({
          where: { groupId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
        }),
        prisma.expense.findFirst({ where: { groupId }, orderBy: { createdAt: "desc" } }),
        prisma.settlement.findFirst({ where: { groupId }, orderBy: { createdAt: "desc" } }),
      ]);

      const iPaidPaise = (myPayments._sum.amountPaise || 0) + (legacyPaidByMe._sum.amountPaise || 0);
      const myFairSharePaise = myShareAgg._sum.amountOwedPaise || 0;

      const myNet = net[userId] || 0;
      const owedToMePaise = myNet > 0 ? myNet : 0;
      const iStillOwePaise = myNet < 0 ? -myNet : 0;

      let settledPaise = 0;
      let pendingPaise = 0;
      let disputedPaise = 0;
      for (const s of settlements) {
        if (s.status === "both_confirmed") {
          settledPaise += s.amountPaise;
        } else if (s.status === "disputed") {
          disputedPaise += s.amountPaise;
        } else {
          pendingPaise += s.amountPaise;
        }
      }

      const lastActivity = [lastExpense?.createdAt, lastSettlement?.createdAt]
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;

      const row: GroupSummaryRow = {
        groupId,
        groupName: membership.group.name,
        myRole,
        totalMembers,
        groupTotalSpending: paiseToRupees(expenseAgg._sum.amountPaise || 0),
        iPaid: paiseToRupees(iPaidPaise),
        myFairShare: paiseToRupees(myFairSharePaise),
        owedToMe: paiseToRupees(owedToMePaise),
        iStillOwe: paiseToRupees(iStillOwePaise),
        settledAmount: paiseToRupees(settledPaise),
        pendingAmount: paiseToRupees(pendingPaise),
        disputedAmount: paiseToRupees(disputedPaise),
        totalExpenses: expenseAgg._count,
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
      };

      return row;
    })
  );

  return rows;
}