export interface Transaction {
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
}

// Takes net balances (positive = owed money, negative = owes money)
// and returns the minimum set of transactions to settle everyone up.
export function simplifyDebts(net: Record<string, number>): Transaction[] {
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  for (const [userId, amount] of Object.entries(net)) {
    if (amount > 0) creditors.push({ userId, amount });
    else if (amount < 0) debtors.push({ userId, amount: -amount });
  }

  // Greedy: largest creditor vs largest debtor each round
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: Transaction[] = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    const settled = Math.min(creditor.amount, debtor.amount);

    transactions.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountPaise: settled,
    });

    creditor.amount -= settled;
    debtor.amount -= settled;

    if (creditor.amount === 0) i++;
    if (debtor.amount === 0) j++;
  }

  return transactions;
}