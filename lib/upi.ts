export function buildUpiLink(payeeUpiId: string, payeeName: string, amountPaise: number, note: string) {
  const amountRupees = (amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: payeeUpiId,
    pn: payeeName,
    am: amountRupees,
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}