import { prisma } from "@/lib/prisma";

export async function getRawBalances(groupId: string) {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { splits: true },
  });

  // net[userId] = total paid - total owed (positive = owed money, negative = owes money)
  const net: Record<string, number> = {};

  for (const expense of expenses) {
    net[expense.paidById] = (net[expense.paidById] || 0) + expense.amountPaise;
    for (const split of expense.splits) {
      net[split.userId] = (net[split.userId] || 0) - split.amountOwedPaise;
    }
  }

  return net; // e.g. { "user1": 15000, "user2": -15000 } → user1 is owed ₹150, user2 owes ₹150
}