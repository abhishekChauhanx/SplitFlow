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

  const rupees = (p: number) => (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const NAVY = "#1e3a5f";
  const NAVY_DARK = "#0f2540";
  const GREEN = "#16a34a";
  const AMBER = "#d97706";
  const RED = "#dc2626";
  const GRAY_BG = "#f4f5f7";
  const GRAY_BORDER = "#e5e7eb";
  const GRAY_TEXT = "#6b7280";
  const INK = "#111827";

  const statusMeta = (status: string) => {
    if (status === "both_confirmed") return { label: "Paid & Confirmed", color: GREEN, bg: "#dcfce7" };
    if (status === "payer_confirmed") return { label: "Awaiting Confirmation", color: AMBER, bg: "#fef3c7" };
    if (status === "disputed") return { label: "Disputed", color: RED, bg: "#fee2e2" };
    return { label: "Not Yet Paid", color: RED, bg: "#fee2e2" };
  };

  function badge(label: string, color: string, bg: string) {
    return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;color:${color};background:${bg};">${label}</span>`;
  }

  const expenseRows = statement.expenses.slice(0, 20).map((e, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : GRAY_BG};">
      <td style="padding:10px 12px;font-size:13px;color:${GRAY_TEXT};border-bottom:1px solid ${GRAY_BORDER};">${formatDate(e.date)}</td>
      <td style="padding:10px 12px;font-size:13px;color:${INK};border-bottom:1px solid ${GRAY_BORDER};">${e.description}</td>
      <td style="padding:10px 12px;font-size:13px;color:${INK};border-bottom:1px solid ${GRAY_BORDER};">${e.paidByName}</td>
      <td style="padding:10px 12px;font-size:13px;color:${INK};font-weight:600;text-align:right;border-bottom:1px solid ${GRAY_BORDER};">Rs. ${rupees(e.amountPaise)}</td>
    </tr>`).join("");

  const settlementRows = statement.settlements.length
    ? statement.settlements.map((s, i) => {
        const meta = statusMeta(s.status);
        return `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : GRAY_BG};">
          <td style="padding:10px 12px;font-size:13px;color:${GRAY_TEXT};border-bottom:1px solid ${GRAY_BORDER};">${formatDate(s.createdAt)}</td>
          <td style="padding:10px 12px;font-size:13px;color:${INK};border-bottom:1px solid ${GRAY_BORDER};">${s.fromName} <span style="color:${GRAY_TEXT};">&rarr;</span> ${s.toName}</td>
          <td style="padding:10px 12px;font-size:13px;color:${INK};font-weight:600;text-align:right;border-bottom:1px solid ${GRAY_BORDER};">Rs. ${rupees(s.amountPaise)}</td>
          <td style="padding:10px 12px;text-align:right;border-bottom:1px solid ${GRAY_BORDER};">${badge(meta.label, meta.color, meta.bg)}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="4" style="padding:16px;text-align:center;font-size:13px;color:${GRAY_TEXT};">No settlement attempts recorded this period.</td></tr>`;

  const pendingRows = statement.stillOwing.length
    ? statement.stillOwing.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : GRAY_BG};">
        <td style="padding:10px 12px;font-size:13px;color:${INK};border-bottom:1px solid ${GRAY_BORDER};">${p.name}</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${RED};text-align:right;border-bottom:1px solid ${GRAY_BORDER};">Rs. ${rupees(p.amountPaise)} still owed</td>
      </tr>`).join("")
    : `<tr><td colspan="2" style="padding:16px;text-align:center;font-size:13px;color:${GREEN};font-weight:600;">Everyone is settled up ✓</td></tr>`;

  const balanceRows = statement.currentBalances.map((b, i) => {
    const isOwed = b.amountPaise >= 0;
    return `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : GRAY_BG};">
      <td style="padding:10px 12px;font-size:13px;color:${INK};border-bottom:1px solid ${GRAY_BORDER};">${b.name}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${isOwed ? GREEN : RED};text-align:right;border-bottom:1px solid ${GRAY_BORDER};">
        ${isOwed ? "Is owed" : "Owes"} Rs. ${rupees(Math.abs(b.amountPaise))}
      </td>
    </tr>`;
  }).join("");

  const settledPct = statement.settlementsInPeriod > 0
    ? Math.round((statement.settlementsConfirmed / statement.settlementsInPeriod) * 100)
    : 100;

  const html = `
  <div style="background:${GRAY_BG};padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

      <!-- Header band -->
      <tr>
        <td style="background:${NAVY};padding:28px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0;font-size:11px;letter-spacing:1px;color:#c7d6e8;text-transform:uppercase;">SplitFlow Group Statement</p>
                <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;">${statement.groupName}</p>
                <p style="margin:6px 0 0;font-size:12.5px;color:#c7d6e8;">${formatDate(statement.periodStart)} &ndash; ${formatDate(statement.periodEnd)} (${statement.periodDays} days)</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Summary stat cards -->
      <tr>
        <td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-right:8px;">
                <div style="background:${NAVY_DARK};border-radius:8px;padding:16px;">
                  <p style="margin:0;font-size:10.5px;letter-spacing:0.5px;color:#c7d6e8;text-transform:uppercase;">Total Spent</p>
                  <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:#ffffff;">Rs. ${rupees(statement.totalSpentPaise)}</p>
                  <p style="margin:4px 0 0;font-size:11.5px;color:#c7d6e8;">${statement.expenseCount} expense${statement.expenseCount === 1 ? "" : "s"} this period</p>
                </div>
              </td>
              <td width="50%" style="padding-left:8px;">
                <div style="background:${GRAY_BG};border:1px solid ${GRAY_BORDER};border-radius:8px;padding:16px;">
                  <p style="margin:0;font-size:10.5px;letter-spacing:0.5px;color:${GRAY_TEXT};text-transform:uppercase;">Settlements Confirmed</p>
                  <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:${INK};">${statement.settlementsConfirmed} / ${statement.settlementsInPeriod}</p>
                  <p style="margin:4px 0 0;font-size:11.5px;color:${settledPct === 100 ? GREEN : AMBER};font-weight:600;">${settledPct}% settled</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Recent expenses -->
      <tr>
        <td style="padding:20px 32px 4px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${NAVY};padding-bottom:8px;">Recent Expenses</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GRAY_BORDER};border-radius:6px;overflow:hidden;">
            <tr style="background:${GRAY_BG};">
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:left;">Date</th>
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:left;">Description</th>
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:left;">Paid By</th>
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:right;">Amount</th>
            </tr>
            ${expenseRows}
          </table>
        </td>
      </tr>

      <!-- Payment status -->
      <tr>
        <td style="padding:24px 32px 4px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${NAVY};padding-bottom:8px;">Payment Status</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GRAY_BORDER};border-radius:6px;overflow:hidden;">
            <tr style="background:${GRAY_BG};">
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:left;">Date</th>
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:left;">Who &rarr; To</th>
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:right;">Amount</th>
              <th style="padding:8px 12px;font-size:10.5px;color:${GRAY_TEXT};text-transform:uppercase;text-align:right;">Status</th>
            </tr>
            ${settlementRows}
          </table>
        </td>
      </tr>

      <!-- Still pending -->
      <tr>
        <td style="padding:24px 32px 4px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${NAVY};padding-bottom:8px;">Still Pending</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GRAY_BORDER};border-radius:6px;overflow:hidden;">
            ${pendingRows}
          </table>
        </td>
      </tr>

      <!-- Current balances -->
      <tr>
        <td style="padding:24px 32px 4px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${INK};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${NAVY};padding-bottom:8px;">Current Balances</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GRAY_BORDER};border-radius:6px;overflow:hidden;">
            ${balanceRows}
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:18px 32px;background:${GRAY_BG};border-top:1px solid ${GRAY_BORDER};">
          <p style="margin:0;font-size:11px;color:${GRAY_TEXT};text-align:center;line-height:1.5;">
            This is an automated statement generated by SplitFlow. Log in to your account to settle up or view full transaction history.
          </p>
        </td>
      </tr>

    </table>
  </div>`;

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