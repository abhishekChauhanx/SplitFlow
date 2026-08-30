import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { generateGroupStatement } from "@/lib/statement-generator";
import { sendEmail } from "@/lib/brevo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { periodDays = 30 } = await req.json();

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a group member" }, { status: 403 });

  const statement = await generateGroupStatement(id, periodDays);

  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    include: { user: true },
  });

  const rupees = (p: number) => (p / 100).toFixed(2);

  const expenseRows = statement.expenses
    .slice(0, 20)
    .map(
      (e) =>
        `<tr><td>${new Date(e.date).toLocaleDateString()}</td><td>${e.description}</td><td>${e.paidByName}</td><td>₹${rupees(e.amountPaise)}</td></tr>`
    )
    .join("");

  const balanceRows = statement.currentBalances
    .map(
      (b) =>
        `<tr><td>${b.name}</td><td style="color:${b.amountPaise >= 0 ? "#16a34a" : "#dc2626"}">${
          b.amountPaise >= 0 ? "is owed" : "owes"
        } ₹${rupees(Math.abs(b.amountPaise))}</td></tr>`
    )
    .join("");

  const html = `
    <h2>${statement.groupName} — ${statement.periodDays}-day statement</h2>
    <p>${new Date(statement.periodStart).toLocaleDateString()} to ${new Date(statement.periodEnd).toLocaleDateString()}</p>
    <p><strong>Total spent:</strong> ₹${rupees(statement.totalSpentPaise)} across ${statement.expenseCount} expenses</p>
    <p><strong>Settlements:</strong> ${statement.settlementsConfirmed} of ${statement.settlementsInPeriod} confirmed</p>

    <h3>Recent expenses</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
      <tr><th>Date</th><th>Description</th><th>Paid by</th><th>Amount</th></tr>
      ${expenseRows}
    </table>

    <h3>Current balances</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
      ${balanceRows}
    </table>

    <p style="color:#888;font-size:12px">Sent via SplitFlow</p>
  `;

  const results = await Promise.allSettled(
    members
      .filter((m) => m.user.email)
      .map((m) =>
        sendEmail({
          to: m.user.email!,
          subject: `${statement.groupName} — ${statement.periodDays}-day statement`,
          html,
        })
      )
  );

  const sentCount = results.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({ ok: true, sentTo: sentCount, totalMembers: members.length });
}