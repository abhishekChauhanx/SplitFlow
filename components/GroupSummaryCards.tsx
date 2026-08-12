"use client";

import type { GroupSummary } from "@/lib/group-summary";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateRange(activeSince: string | null, lastActivity: string | null) {
  if (!activeSince) return "—";
  const start = new Date(activeSince);
  const end = lastActivity ? new Date(lastActivity) : start;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-IN", opts);
  const endStr = end.toLocaleDateString("en-IN", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

const cardStyle: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: "14px 16px",
  minWidth: 150,
  flex: "1 1 150px",
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#888", marginBottom: 6 };
const valueStyle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: "#eee", lineHeight: 1.3 };

// Loose shape — only what this component needs from a recurring template,
// so it doesn't have to import the full RecurringTemplateRow type from the
// page and stays reusable even if that type grows.
type RecurringSummaryInput = {
  active: boolean;
};

export default function GroupSummaryCards({
  summary,
  recurringTemplates = [],
}: {
  summary: GroupSummary;
  recurringTemplates?: RecurringSummaryInput[];
}) {
  const activeRecurringCount = recurringTemplates.filter((t) => t.active).length;
  const totalRecurringCount = recurringTemplates.length;

  const cards = [
    { label: "Total group spending", value: formatCurrency(summary.totalGroupSpending) },
    { label: "Members", value: String(summary.memberCount) },
    { label: "Expenses", value: String(summary.expenseCount) },
    { label: "Active since", value: formatDateRange(summary.activeSince, summary.lastActivity) },
    { label: "Fully settled", value: formatCurrency(summary.settledAmount) },
    { label: "Pending to settle", value: formatCurrency(summary.pendingAmount) },
    { label: "Disputed", value: formatCurrency(summary.disputedAmount) },
    {
      label: "Biggest single expense",
      value: summary.biggestExpense
        ? `${formatCurrency(summary.biggestExpense.amountPaise / 100)} (${summary.biggestExpense.description})`
        : "—",
    },
    {
      label: "Most spent by one person",
      value: summary.topSpender
        ? `${summary.topSpender.name} — ${formatCurrency(summary.topSpender.amountPaise / 100)}`
        : "—",
    },
    { label: "Average expense size", value: formatCurrency(summary.averageExpenseSize) },
    {
      label: "Recurring templates",
      value:
        totalRecurringCount === 0
          ? "—"
          : activeRecurringCount === totalRecurringCount
          ? `${activeRecurringCount} active`
          : `${activeRecurringCount} active / ${totalRecurringCount} total`,
    },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0 24px" }}>
      {cards.map((c) => (
        <div key={c.label} style={cardStyle}>
          <div style={labelStyle}>{c.label}</div>
          <div style={valueStyle}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}