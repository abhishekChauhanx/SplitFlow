export function splitEqual(amountPaise: number, memberIds: string[], payerId: string) {
  const share = Math.floor(amountPaise / memberIds.length);
  const remainder = amountPaise - share * memberIds.length;
  return memberIds.map((userId) => ({
    userId,
    amountOwedPaise: userId === payerId ? share + remainder : share,
  }));
}

export function splitByShares(amountPaise: number, shareUnits: Record<string, number>, payerId: string) {
  const totalUnits = Object.values(shareUnits).reduce((sum, u) => sum + u, 0);
  if (totalUnits === 0) throw new Error("Total share units cannot be zero");

  const entries = Object.entries(shareUnits);
  let allocated = 0;
  return entries.map(([userId, units], index) => {
    const isLast = index === entries.length - 1;
    const amount = isLast
      ? amountPaise - allocated
      : Math.floor((amountPaise * units) / totalUnits);
    allocated += amount;
    return { userId, amountOwedPaise: amount };
  });
}

// Exact split: each person specifies exactly how much they owe
// Must sum to amountPaise exactly, or it returns an error
export function splitExact(
  amountPaise: number,
  exactAmounts: Record<string, number>
): { userId: string; amountOwedPaise: number }[] {
  const total = Object.values(exactAmounts).reduce((sum, a) => sum + a, 0);
  if (total !== amountPaise) {
    throw new Error(`Exact amounts sum to ${total} paise but expense is ${amountPaise} paise`);
  }
  return Object.entries(exactAmounts).map(([userId, amountOwedPaise]) => ({
    userId,
    amountOwedPaise,
  }));
}

// Percentage split: each person specifies what % they owe
// Percentages must sum to 100 (within 0.01 tolerance for float arithmetic)
export function splitByPercentage(
  amountPaise: number,
  percentages: Record<string, number>,
  payerId: string
): { userId: string; amountOwedPaise: number }[] {
  const totalPct = Object.values(percentages).reduce((sum, p) => sum + p, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`Percentages sum to ${totalPct}%, must be 100%`);
  }

  const entries = Object.entries(percentages);
  let allocated = 0;
  return entries.map(([userId, pct], index) => {
    const isLast = index === entries.length - 1;
    const amount = isLast
      ? amountPaise - allocated
      : Math.floor((amountPaise * pct) / 100);
    allocated += amount;
    return { userId, amountOwedPaise: amount };
  });
}