import { prisma } from "@/lib/prisma";

/**
 * Net balance for one user in one group, in paise.
 * Positive = the group owes this user money (they're owed).
 * Negative = this user owes the group money.
 * Zero = fully settled, safe to leave.
 *
 * Mirrors the same underlying data getGroupSummary() uses (Expense +
 * ExpenseSplit for the raw math, Settlement.status === "both_confirmed"
 * as the only status that actually moves money) so "settled" here means
 * the same thing it means everywhere else in the app.
 */
export async function getUserNetBalance(groupId: string, userId: string): Promise<number> {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { splits: true },
  });

  let balance = 0;

  for (const expense of expenses) {
    // What they paid on behalf of the group — credits their balance
    if (expense.paidById === userId) {
      balance += expense.amountPaise;
    }
    // Their share of every expense — debits their balance
    const mySplit = expense.splits.find((s) => s.userId === userId);
    if (mySplit) {
      balance -= mySplit.amountOwedPaise;
    }
  }

  // Only fully-confirmed settlements actually move money in this app's
  // model — matches getGroupSummary()'s settledPaise calculation exactly.
  const settlements = await prisma.settlement.findMany({
    where: {
      groupId,
      status: "both_confirmed",
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
  });

  for (const s of settlements) {
    if (s.fromUserId === userId) balance += s.amountPaise; // they paid off a debt — credits back
    if (s.toUserId === userId) balance -= s.amountPaise; // they received a payment — debits what they were owed
  }

  return balance;
}