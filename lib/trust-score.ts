import { prisma } from "@/lib/prisma";

const MIN_SETTLEMENTS_FOR_FULL_SCORE = 5; // below this, treat as "New member" regardless of score
const ON_TIME_WINDOW_HOURS = 48;

interface ScoreComponents {
  score: number;
  label: string;
  onTimeRate: number;
  disputeRate: number;
  utrSubmissionRate: number;
  completionRate: number;
  totalSettlements: number;
}

export async function calculateTrustScore(userId: string): Promise<ScoreComponents> {
  // Pull every settlement where this user was the PAYER — trust score is about
  // "does this person pay what they owe", not about being owed money.
  const settlements = await prisma.settlement.findMany({
    where: { fromUserId: userId },
  });

  const total = settlements.length;

  if (total === 0) {
    return {
      score: 50,
      label: "New member",
      onTimeRate: 0,
      disputeRate: 0,
      utrSubmissionRate: 0,
      completionRate: 0,
      totalSettlements: 0,
    };
  }

  // ── 1. On-time confirmation rate ──
  // Did the payer confirm within 48h of the payee confirming (or vice versa,
  // whichever confirmation came second)? Only counts settlements where BOTH
  // sides eventually confirmed — a settlement stuck at "pending" forever
  // is captured separately by completion rate, not penalized twice here.
  const bothConfirmed = settlements.filter(
    (s) => s.payerConfirmedAt && s.payeeConfirmedAt
  );
  let onTimeCount = 0;
  for (const s of bothConfirmed) {
    const payerTime = s.payerConfirmedAt!.getTime();
    const payeeTime = s.payeeConfirmedAt!.getTime();
    // The payer's confirmation is what we're scoring here (this user IS the payer)
    // "on time" = payer confirmed within 48h of the settlement being created
    const hoursSinceCreated = (payerTime - s.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated <= ON_TIME_WINDOW_HOURS) onTimeCount++;
  }
  const onTimeRate = bothConfirmed.length > 0 ? onTimeCount / bothConfirmed.length : 0;

  // ── 2. Dispute rate ──
  const disputedCount = settlements.filter((s) => s.status === "disputed").length;
  const disputeRate = disputedCount / total;

  // ── 3. UTR submission rate ──
  // Only meaningful for UPI payments — cash payments have no UTR by definition
  // and shouldn't be penalized for it.
  const upiSettlements = settlements.filter((s) => s.paymentMethod === "upi");
  const utrProvided = upiSettlements.filter((s) => !!s.utrNumber).length;
  const utrSubmissionRate = upiSettlements.length > 0 ? utrProvided / upiSettlements.length : 1; // no UPI payments = neutral, not penalized

  // ── 4. Completion rate ──
  const completedCount = settlements.filter((s) => s.status === "both_confirmed").length;
  const completionRate = completedCount / total;

  // ── Combine into final score (weighted) ──
  const weighted =
    onTimeRate * 35 +
    (1 - disputeRate) * 25 +
    utrSubmissionRate * 15 +
    completionRate * 25;

  const score = Math.round(weighted);

  // Label depends on both score AND sample size — a 95 score from 1 settlement
  // is not the same trust signal as a 95 from 50 settlements.
  let label: string;
  if (total < MIN_SETTLEMENTS_FOR_FULL_SCORE) {
    label = "New member";
  } else if (score >= 90) {
    label = "Highly reliable";
  } else if (score >= 75) {
    label = "Reliable";
  } else if (score >= 55) {
    label = "Usually reliable";
  } else {
    label = "Building trust";
  }

  return {
    score,
    label,
    onTimeRate,
    disputeRate,
    utrSubmissionRate,
    completionRate,
    totalSettlements: total,
  };
}

export async function recalculateAndSaveTrustScore(userId: string) {
  const result = await calculateTrustScore(userId);

  await prisma.trustScore.upsert({
    where: { userId },
    update: {
      score: result.score,
      label: result.label,
      onTimeRate: result.onTimeRate,
      disputeRate: result.disputeRate,
      utrSubmissionRate: result.utrSubmissionRate,
      completionRate: result.completionRate,
      totalSettlements: result.totalSettlements,
      lastCalculatedAt: new Date(),
    },
    create: {
      userId,
      score: result.score,
      label: result.label,
      onTimeRate: result.onTimeRate,
      disputeRate: result.disputeRate,
      utrSubmissionRate: result.utrSubmissionRate,
      completionRate: result.completionRate,
      totalSettlements: result.totalSettlements,
    },
  });

  return result;
}