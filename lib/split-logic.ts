// Splits an amount (in paise) equally among N members.
// Any leftover paise from integer division goes to the payer.
export function splitEqual(amountPaise: number, memberIds: string[], payerId: string) {
  const share = Math.floor(amountPaise / memberIds.length);
  const remainder = amountPaise - share * memberIds.length;

  return memberIds.map((userId) => ({
    userId,
    amountOwedPaise: userId === payerId ? share + remainder : share,
  }));
}