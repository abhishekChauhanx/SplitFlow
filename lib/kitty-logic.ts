export interface RefundResult {
  userId: string;
  contributedPaise: number;
  refundPaise: number;
}

// Calculates proportional refunds for whatever's left in the pool.
// Same rounding-remainder-to-last-person pattern used elsewhere in the app,
// so the total refunded always equals the leftover exactly — never off by a paisa.
export function calculateRefunds(
  contributions: { userId: string; paidAmountPaise: number }[],
  leftoverPaise: number
): RefundResult[] {
  const totalContributed = contributions.reduce((sum, c) => sum + c.paidAmountPaise, 0);

  if (totalContributed === 0 || leftoverPaise <= 0) {
    return contributions.map((c) => ({
      userId: c.userId,
      contributedPaise: c.paidAmountPaise,
      refundPaise: 0,
    }));
  }

  let allocated = 0;
  return contributions.map((c, index) => {
    const isLast = index === contributions.length - 1;
    const refund = isLast
      ? leftoverPaise - allocated
      : Math.floor((leftoverPaise * c.paidAmountPaise) / totalContributed);
    allocated += refund;
    return {
      userId: c.userId,
      contributedPaise: c.paidAmountPaise,
      refundPaise: refund,
    };
  });
}