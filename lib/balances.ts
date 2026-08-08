import { prisma } from "@/lib/prisma";

/**
 * ⚠️ RECONSTRUCTED FILE — the original lib/balances.ts was not available when
 * this was written. This version was inferred from the rest of the codebase
 * (Settlement.status === "both_confirmed" gating edits elsewhere, the
 * ExpenseSplit model, and the new multi-payer ExpensePayment model).
 *
 * If your real lib/balances.ts does anything differently (e.g. a different
 * settlement rule, placeholder-member handling, etc.), merge that logic in
 * here rather than assuming this is a drop-in replacement. Back up the
 * original before overwriting.
 *
 * Returns a map of userId -> net balance in paise.
 *   positive = this person is owed money (others owe them)
 *   negative = this person owes money
 */
export async function getRawBalances(groupId: string): Promise<Record<string, number>> {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      payments: true, // multi-payer contributions (new)
      splits: true,
    },
  });

  const net: Record<string, number> = {};

  for (const expense of expenses) {
    // ── Paid side ──
    if (expense.payments.length > 0) {
      // New-style expense: sum each contributor's actual payment
      for (const payment of expense.payments) {
        net[payment.userId] = (net[payment.userId] || 0) + payment.amountPaise;
      }
    } else {
      // Legacy expense with no ExpensePayment rows yet — fall back to paidById
      net[expense.paidById] = (net[expense.paidById] || 0) + expense.amountPaise;
    }

    // ── Owed side ──
    for (const split of expense.splits) {
      net[split.userId] = (net[split.userId] || 0) - split.amountOwedPaise;
    }
  }

  // ── Confirmed settlements reduce what the payer owes the receiver ──
  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: "both_confirmed" },
  });

  for (const settlement of settlements) {
    net[settlement.fromUserId] = (net[settlement.fromUserId] || 0) + settlement.amountPaise;
    net[settlement.toUserId] = (net[settlement.toUserId] || 0) - settlement.amountPaise;
  }

  return net;
}