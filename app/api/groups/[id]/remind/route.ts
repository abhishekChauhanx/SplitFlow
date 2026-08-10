import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { getRawBalances } from "@/lib/balances";
import { simplifyDebts } from "@/lib/debt-simplify";
import { sendReminderEmail } from "@/lib/brevo";

const REMINDER_COOLDOWN_HOURS = 24;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { remindUserId, amountPaise } = await req.json();
  if (!remindUserId || !amountPaise) {
    return NextResponse.json({ error: "Missing remindUserId or amountPaise" }, { status: 400 });
  }

  // Recompute the group's actual debts server-side — never trust the pairing
  // or amount the client sent. This also implicitly confirms both users are
  // members of this group, since balances are only computed from group data.
  const net = await getRawBalances(groupId);
  const transactions = simplifyDebts(net);
  const matching = transactions.find(
    (t) => t.fromUserId === remindUserId && t.toUserId === userId && t.amountPaise === amountPaise
  );
  if (!matching) {
    return NextResponse.json(
      { error: "This doesn't match an actual outstanding debt to you in this group" },
      { status: 400 }
    );
  }

  const remindUser = await prisma.user.findUnique({ where: { id: remindUserId } });
  if (!remindUser || !remindUser.email) {
    return NextResponse.json(
      { error: "This person has no email address — they may be a placeholder member" },
      { status: 400 }
    );
  }

  // Rate-limit: one reminder per (group, payer, payee) pair per cooldown window
  const cooldownStart = new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);
  const recent = await prisma.paymentReminder.findFirst({
    where: { groupId, fromUserId: remindUserId, toUserId: userId, sentAt: { gte: cooldownStart } },
    orderBy: { sentAt: "desc" },
  });
  if (recent) {
    const msRemaining = recent.sentAt.getTime() + REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000 - Date.now();
    const hoursLeft = Math.max(1, Math.ceil(msRemaining / (60 * 60 * 1000)));
    return NextResponse.json(
      {
        error: `You already reminded ${remindUser.name || remindUser.email} recently — try again in about ${hoursLeft}h`,
      },
      { status: 429 }
    );
  }

  const sender = await prisma.user.findUnique({ where: { id: userId } });
  const group = await prisma.group.findUnique({ where: { id: groupId } });

  const amount = `₹${(amountPaise / 100).toFixed(2)}`;
  const groupName = group?.name || "your group";
  const senderName = sender?.name || sender?.email || "Someone";

  await sendReminderEmail({
    to: remindUser.email,
    recipientName: remindUser.name || "there",
    senderName,
    amount,
    groupName,
    payUrl: `${process.env.NEXT_PUBLIC_APP_URL}/groups/${groupId}/settle`,
  });

  await prisma.paymentReminder.create({
    data: { groupId, fromUserId: remindUserId, toUserId: userId, amountPaise },
  });

  return NextResponse.json({ ok: true });
}