export function splitEqual(amountPaise: number, memberIds: string[], payerId: string) {
  const share = Math.floor(amountPaise / memberIds.length);
  const remainder = amountPaise - share * memberIds.length;

  return memberIds.map((userId) => ({
    userId,
    amountOwedPaise: userId === payerId ? share + remainder : share,
  }));
}

// Splits an amount proportionally by "shares" (e.g. number of meals eaten).
// shareUnits: { userId: units }. Leftover paise from rounding goes to the payer.
export function splitByShares(
  amountPaise: number,
  shareUnits: Record<string, number>,
  payerId: string
) {
  const totalUnits = Object.values(shareUnits).reduce((sum, u) => sum + u, 0);
  if (totalUnits === 0) throw new Error("Total share units cannot be zero");

  const entries = Object.entries(shareUnits);
  let allocated = 0;
  const result = entries.map(([userId, units], index) => {
    const isLast = index === entries.length - 1;
    const amount = isLast
      ? amountPaise - allocated // last person gets the remainder, avoids rounding loss
      : Math.floor((amountPaise * units) / totalUnits);
    allocated += amount;
    return { userId, amountOwedPaise: amount };
  });

  return result;
}