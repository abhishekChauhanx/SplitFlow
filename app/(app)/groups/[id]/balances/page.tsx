"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useAppShell } from "@/components/app-shell/AppShellContext";
import "../../../../home.css";
import "./balances.css";

type Balance = {
  userId: string;
  name: string;
  netPaise: number;
};

type Payment = {
  payer: Balance;
  receiver: Balance;
  amountPaise: number;
};

export default function BalancesPage() {
  const { id } = useParams();
  const { setSidebarSection } = useAppShell();

  const [balances, setBalances] = useState<Balance[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [meResponse, groupResponse, balancesResponse, recurringResponse] = await Promise.all([
        fetch("/api/me"),
        fetch(`/api/groups/${id}`),
        fetch(`/api/groups/${id}/balances`),
        fetch(`/api/groups/${id}/recurring`),
      ]);

      const me = await meResponse.json();
      const balanceData = await balancesResponse.json();

      setCurrentUserId(me.userId);
      setBalances(balanceData);
      if (groupResponse.ok) {
        const group = await groupResponse.json();
        setGroupName(group?.name || null);
      }
      if (recurringResponse.ok) setRecurringTemplates(await recurringResponse.json());
    } catch (error) {
      console.error("Failed to load balances:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();

    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        loadData();
      }
    }
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [loadData]);

  useEffect(() => {
    setSidebarSection({
      label: groupName || "Group",
      items: [
        { href: `/groups/${id}/balances`, label: "View balance" },
        { href: `/groups/${id}/settle`, label: "Settle" },
        { href: `/groups/${id}/recurring`, label: "Recurring expenses" },
      ],
    });
    return () => setSidebarSection(null);
  }, [id, groupName, setSidebarSection]);

  const creditors = balances.filter((b) => b.netPaise > 0);
  const debtors = balances.filter((b) => b.netPaise < 0);
  const settled = balances.filter((b) => b.netPaise === 0);

  function formatAmount(paise: number) {
    return `₹${(Math.abs(paise) / 100).toFixed(2)}`;
  }

  function initials(name: string) {
    return (name || "?").trim()[0]?.toUpperCase() || "?";
  }

  function displayName(user: Balance) {
    return user.userId === currentUserId ? `${user.name} (me)` : user.name;
  }

  function calculatePayments(): Payment[] {
    const debtorsCopy = debtors.map((user) => ({
      ...user,
      remaining: Math.abs(user.netPaise),
    }));

    const creditorsCopy = creditors.map((user) => ({
      ...user,
      remaining: user.netPaise,
    }));

    const payments: Payment[] = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtorsCopy.length && creditorIndex < creditorsCopy.length) {
      const debtor = debtorsCopy[debtorIndex];
      const creditor = creditorsCopy[creditorIndex];

      const amount = Math.min(debtor.remaining, creditor.remaining);

      if (amount > 0) {
        payments.push({ payer: debtor, receiver: creditor, amountPaise: amount });
      }

      debtor.remaining -= amount;
      creditor.remaining -= amount;

      if (debtor.remaining === 0) debtorIndex++;
      if (creditor.remaining === 0) creditorIndex++;
    }

    return payments;
  }

  const payments = calculatePayments();

  function getPaymentDescription(payer: Balance, receiver: Balance, amountPaise: number) {
    const payerIsMe = payer.userId === currentUserId;
    const receiverIsMe = receiver.userId === currentUserId;

    if (payerIsMe) return `You owe ${receiver.name}`;
    if (receiverIsMe) return `${payer.name} owes you`;
    return `${payer.name} owes ${receiver.name}`;
  }

  const totalYouOwe = payments
    .filter((p) => p.payer.userId === currentUserId)
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const totalYouAreOwed = payments
    .filter((p) => p.receiver.userId === currentUserId)
    .reduce((sum, p) => sum + p.amountPaise, 0);

  const netPosition = totalYouAreOwed - totalYouOwe;

  return (
    <div className="dash-page">
      <div className="hero-glow" />
      <div className="hero-grid" />

      <SFLoaderOverlay visible={loading} label="Loading balances" />

      <div className="dash-container bal-page">
        <div className="bal-breadcrumb">
          <Link href="/dashboard">Dashboard</Link> / <Link href={`/groups/${id}`}>{groupName || "Group"}</Link> / Balances
        </div>

        <div className="bal-header-row">
          <h1 className="text-gradient bal-title">Who owes what</h1>
          <RefreshButton onRefresh={loadData} label="Refreshing balances" />
        </div>

        {/* Stat summary — your personal net position at a glance */}
        {balances.length > 0 && (
          <div className="bal-stats">
            <div className="bal-stat-card">
              <p className="bal-stat-label">You owe</p>
              <p className="bal-stat-value negative">{formatAmount(totalYouOwe)}</p>
            </div>
            <div className="bal-stat-card">
              <p className="bal-stat-label">You're owed</p>
              <p className="bal-stat-value positive">{formatAmount(totalYouAreOwed)}</p>
            </div>
            <div className="bal-stat-card">
              <p className="bal-stat-label">Net position</p>
              <p className={`bal-stat-value ${netPosition === 0 ? "neutral" : netPosition > 0 ? "positive" : "negative"}`}>
                {netPosition >= 0 ? "+" : "-"}
                {formatAmount(netPosition)}
              </p>
            </div>
          </div>
        )}

        {/* Active recurring templates */}
        {recurringTemplates.filter((t: any) => t.active).length > 0 && (
          <div className="bal-card" style={{ marginTop: "1.5rem" }}>
            <p className="bal-card-label">Upcoming recurring charges</p>
            {recurringTemplates
              .filter((t: any) => t.active)
              .map((t: any) => (
                <div key={t.id} className="bal-recurring-row">
                  <span className="name">{t.description}</span>
                  <span className="meta">
                    ₹{(t.amountPaise / 100).toFixed(2)}
                    {t.nextRunAt && ` · next run ${new Date(t.nextRunAt).toLocaleDateString()}`}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Everyone settled */}
        {balances.length > 0 && creditors.length === 0 && debtors.length === 0 && (
          <div className="bal-settled-banner" style={{ marginTop: "1.5rem" }}>
            <span className="emoji">🎉</span>
            <p className="title">Everyone is settled up!</p>
            <p className="sub">No one owes anything right now.</p>
          </div>
        )}

        {/* TO PAY */}
        {payments.length > 0 && (
          <section className="bal-section">
            <p className="bal-section-label">
              <span className="dot red" /> To pay
            </p>

            <div className="bal-list">
              {payments.map((payment, index) => {
                const { payer, receiver, amountPaise } = payment;
                const payerIsMe = payer.userId === currentUserId;
                const receiverIsMe = receiver.userId === currentUserId;

                return (
                  <div key={`${payer.userId}-${receiver.userId}-${index}`} className="bal-row owe">
                    <div className="bal-avatars">
                      <span className="bal-avatar">{initials(payer.name)}</span>
                      <span className="bal-avatar second">{initials(receiver.name)}</span>
                    </div>
                    <div className="bal-row-main">
                      <p className="bal-row-names" style={{ margin: 0 }}>
                        <strong>{payerIsMe ? `${payer.name} (me)` : payer.name}</strong> → <strong>{receiverIsMe ? `${receiver.name} (me)` : receiver.name}</strong>
                      </p>
                      <p className="bal-row-desc">{getPaymentDescription(payer, receiver, amountPaise)}</p>
                    </div>
                    <span className="bal-amount negative">-{formatAmount(amountPaise)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TO RECEIVE */}
        {creditors.length > 0 && (
          <section className="bal-section">
            <p className="bal-section-label">
              <span className="dot green" /> To receive money
            </p>

            <div className="bal-list">
              {creditors.map((user) => (
                <div key={user.userId} className="bal-row owed">
                  <span className="bal-avatar">{initials(user.name)}</span>
                  <div className="bal-row-main">
                    <p className="bal-row-names" style={{ margin: 0 }}>
                      <strong>{displayName(user)}</strong>
                    </p>
                    <p className="bal-row-desc">Paid more than their share — others owe them</p>
                  </div>
                  <span className="bal-amount positive">+{formatAmount(user.netPaise)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SETTLED */}
        {settled.length > 0 && (
          <section className="bal-section">
            <p className="bal-section-label">
              <span className="dot gray" /> Settled up
            </p>

            <div className="bal-list">
              {settled.map((user) => (
                <div key={user.userId} className="bal-settled-row">
                  <span className="bal-avatar">{initials(user.name)}</span>
                  <span className="name">{displayName(user)}</span>
                  <span className="check">✓ all clear</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SUMMARY / LEGEND */}
        {(creditors.length > 0 || debtors.length > 0) && (
          <div className="bal-legend">
            <p className="heading">How to read this</p>
            <p>
              <span className="pos">Green (+)</span> = this person is owed money.
            </p>
            <p>
              <span className="neg">Red (-)</span> = this person needs to pay.
            </p>
            <p>
              Go to <span className="accent">Settle up</span> to record payments and clear balances.
            </p>
          </div>
        )}

        {/* NO DATA */}
        {!loading && balances.length === 0 && (
          <div className="bal-empty">No balance information available.</div>
        )}
      </div>
    </div>
  );
}