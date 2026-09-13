"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import { useModal } from "@/components/ModalProvider";
import { useAppShell } from "@/components/app-shell/AppShellContext";
import "../../../../home.css";
import "./settle.css";

export default function SettlePage() {
  const { id } = useParams();
  const { confirm, prompt } = useModal();
  const { setSidebarSection } = useAppShell();

  const [groupName, setGroupName] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [showPartialInput, setShowPartialInput] = useState<Record<number, boolean>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});
  const [utrErrors, setUtrErrors] = useState<Record<string, string>>({});
  const [savingUtr, setSavingUtr] = useState<string | null>(null);
  const [utrSaved, setUtrSaved] = useState<Record<string, boolean>>({});

  const [payDialog, setPayDialog] = useState<{ index: number; mode: "pay" | "view" } | null>(null);
  const [utrDialogSettlementId, setUtrDialogSettlementId] = useState<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [markingPaidIndex, setMarkingPaidIndex] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ id: string; action: "reopen" | "forgive" } | null>(null);
  const [remindingIndex, setRemindingIndex] = useState<number | null>(null);

  async function generateQr(index: number, s: any, amountPaiseOverride?: number) {
    if (!s.toUpiId) return;
    const amountPaise = amountPaiseOverride ?? s.amountPaise;
    const amountRupees = (amountPaise / 100).toFixed(2);
    const upiUrl = `upi://pay?pa=${s.toUpiId}&pn=${encodeURIComponent(s.toName)}&am=${amountRupees}&cu=INR&tn=Settlement`;
    const dataUrl = await QRCode.toDataURL(upiUrl);
    setQrCodes((prev) => ({ ...prev, [index]: dataUrl }));
  }

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) {
      const me = await res.json();
      setCurrentUserId(me.userId);
    }
  }, []);

  const loadGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}`);
    if (res.ok) {
      const group = await res.json();
      setGroupName(group?.name || null);
    }
  }, [id]);

  const loadSuggestions = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/settlements`);
    const data = await res.json();
    setSuggestions(data);
    await Promise.all(data.map((s: any, i: number) => generateQr(i, s)));
  }, [id]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/settlement-history`);
    setHistory(await res.json());
  }, [id]);

  const loadRecurringTemplates = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/recurring`);
    if (res.ok) setRecurringTemplates(await res.json());
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMe(), loadGroup(), loadSuggestions(), loadHistory(), loadRecurringTemplates()]);
  }, [loadMe, loadGroup, loadSuggestions, loadHistory, loadRecurringTemplates]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));

    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    }
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [refreshAll]);

  // Keep the group's sidebar sub-nav visible while on this page too.
useEffect(() => {
  setSidebarSection({
    label: groupName || "Group",
    href: `/groups/${id}`,   // ← must be present
    items: [
      { href: `/groups/${id}/balances`, label: "View balance" },
      { href: `/groups/${id}/settle`, label: "Settle" },
      { href: `/groups/${id}/recurring`, label: "Recurring expenses" },
    ],
  });
  return () => setSidebarSection(null);
}, [id, groupName, setSidebarSection]);

  function handlePartialChange(index: number, value: string, s: any) {
    setPartialAmounts({ ...partialAmounts, [index]: value });
    const amountPaise = value ? Math.round(parseFloat(value) * 100) : s.amountPaise;
    if (!isNaN(amountPaise) && amountPaise > 0) {
      generateQr(index, s, amountPaise);
    }
  }

  function closePayDialog() {
    setPayDialog(null);
  }

  function pendingSettlementFor(fromUserId: string, toUserId: string) {
    return history.find(
      (h) =>
        h.fromUserId === fromUserId &&
        h.toUserId === toUserId &&
        h.status !== "both_confirmed" &&
        h.status !== "disputed" &&
        (h.paymentMethod === "cash" || !!h.utrNumber)
    );
  }

  async function recordSettlement(index: number, s: any) {
    const amountToSend = partialAmounts[index]
      ? Math.round(parseFloat(partialAmounts[index]) * 100)
      : s.amountPaise;
    const paymentMethod = paymentMethods[index] || "upi";

    const ok = await confirm({
      title: "Mark as paid?",
      message: `Confirm you're paying ${s.toName} ₹${(amountToSend / 100).toFixed(2)} via ${
        paymentMethod === "cash" ? "cash" : "UPI"
      }.`,
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;

    setMarkingPaidIndex(index);
    try {
      const res = await fetch(`/api/groups/${id}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: s.toUserId, amountPaise: amountToSend, paymentMethod }),
      });

      if (!res.ok) {
        const data = await res.json();
        await confirm({ title: "Couldn't record settlement", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }

      const created = await res.json();
      closePayDialog();
      await loadHistory();

      if (paymentMethod === "upi") {
        setUtrDialogSettlementId(created.id);
      } else {
        await confirm({
          title: "Recorded",
          message: "Cash payment recorded. Ask the recipient to confirm they received it.",
          mode: "alert",
        });
      }
    } finally {
      setMarkingPaidIndex(null);
    }
  }

  async function saveUtr(settlementId: string): Promise<boolean> {
    const utr = utrInputs[settlementId]?.trim().toUpperCase();
    setUtrErrors((prev) => ({ ...prev, [settlementId]: "" }));

    if (!utr) {
      setUtrErrors((prev) => ({ ...prev, [settlementId]: "Please enter a UTR number" }));
      return false;
    }
    if (!/^[A-Z0-9]{12}$/i.test(utr)) {
      setUtrErrors((prev) => ({
        ...prev,
        [settlementId]: "UTR must be exactly 12 alphanumeric characters (e.g. HDFC000123456)",
      }));
      return false;
    }

    setSavingUtr(settlementId);
    try {
      const res = await fetch(`/api/settlements/${settlementId}/utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrNumber: utr }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUtrErrors((prev) => ({ ...prev, [settlementId]: data.error }));
        return false;
      }

      setUtrSaved((prev) => ({ ...prev, [settlementId]: true }));
      await loadHistory();
      return true;
    } finally {
      setSavingUtr(null);
    }
  }

  async function handleUtrDialogSubmit() {
    if (!utrDialogSettlementId) return;
    const success = await saveUtr(utrDialogSettlementId);
    if (success) setUtrDialogSettlementId(null);
  }

  function skipUtrDialog() {
    setUtrDialogSettlementId(null);
  }

  async function confirmSettlement(h: any) {
    const isPayer = h.fromUserId === currentUserId;
    const ok = await confirm({
      title: "Confirm this payment?",
      message: `Confirm that ₹${(h.amountPaise / 100).toFixed(2)} ${
        isPayer ? `was paid to ${h.toName}` : `was received from ${h.fromName}`
      }.`,
      confirmLabel: "Confirm",
    });
    if (!ok) return;

    setConfirmingId(h.id);
    try {
      const res = await fetch(`/api/settlements/${h.id}/confirm`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await confirm({ title: "Couldn't confirm", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }
      await Promise.all([loadHistory(), loadSuggestions()]);
    } finally {
      setConfirmingId(null);
    }
  }

  async function disputeSettlement(settlementId: string) {
    const reason = await prompt({
      title: "Dispute this settlement",
      message: "What doesn't match?",
      placeholder: "e.g. wrong amount, never received",
      confirmLabel: "Submit dispute",
      required: true,
    });
    if (!reason) return;

    setDisputingId(settlementId);
    try {
      const res = await fetch(`/api/settlements/${settlementId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await confirm({ title: "Couldn't dispute", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }
      await loadHistory();
    } finally {
      setDisputingId(null);
    }
  }

  async function quickDispute(settlementId: string, reason: string) {
    const ok = await confirm({
      title: "Report this payment?",
      message: `This will flag the settlement as disputed: "${reason}". The other side will need to sort it out with you.`,
      confirmLabel: "Report issue",
    });
    if (!ok) return;

    setDisputingId(settlementId);
    try {
      const res = await fetch(`/api/settlements/${settlementId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await confirm({ title: "Couldn't report issue", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }
      await loadHistory();
    } finally {
      setDisputingId(null);
    }
  }

  async function reopenSettlement(h: any) {
    const ok = await confirm({
      title: "Reopen this settlement?",
      message: `This resets it back to pending so ${h.fromName} can try the payment again. The existing UTR and confirmations will be cleared.`,
      confirmLabel: "Reopen",
    });
    if (!ok) return;

    setResolving({ id: h.id, action: "reopen" });
    try {
      const res = await fetch(`/api/settlements/${h.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: h.disputeReason, resolution: "reopen" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await confirm({ title: "Couldn't reopen", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }
      await Promise.all([loadHistory(), loadSuggestions()]);
    } finally {
      setResolving(null);
    }
  }

  async function forgiveSettlement(h: any) {
    const reason = await prompt({
      title: "Mark as resolved anyway?",
      message: "Why are you forgiving this dispute? This settles it despite the disagreement.",
      placeholder: "e.g. sorted it out in person",
      confirmLabel: "Forgive & settle",
      required: true,
    });
    if (!reason) return;

    setResolving({ id: h.id, action: "forgive" });
    try {
      const res = await fetch(`/api/settlements/${h.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, resolution: "forgive" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await confirm({ title: "Couldn't forgive dispute", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }
      await Promise.all([loadHistory(), loadSuggestions()]);
    } finally {
      setResolving(null);
    }
  }

  async function sendReminder(index: number, s: any) {
    const ok = await confirm({
      title: "Send reminder?",
      message: `Send a reminder email to ${s.fromName} about the ₹${(s.amountPaise / 100).toFixed(2)} they owe you.`,
      confirmLabel: "Send reminder",
    });
    if (!ok) return;

    setRemindingIndex(index);
    try {
      const res = await fetch(`/api/groups/${id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remindUserId: s.fromUserId, amountPaise: s.amountPaise }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await confirm({ title: "Couldn't send reminder", message: data.error || "Something went wrong.", mode: "alert" });
        return;
      }
      await confirm({ title: "Reminder sent", message: `${s.fromName} has been emailed a reminder.`, mode: "alert" });
    } finally {
      setRemindingIndex(null);
    }
  }

  const activeIndex = payDialog?.index ?? null;
  const activeSuggestion = activeIndex != null ? suggestions[activeIndex] : null;
  const isPayMode = payDialog?.mode === "pay";

  return (
    <div className="dash-page settle-page">
      <div className="hero-glow" />
      <div className="hero-grid" />

      <SFLoaderOverlay visible={initialLoading} label="Loading settle up" />

      <div className="dash-container">
        <div className="settle-breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="sep">/</span>
          <Link href={`/groups/${id}`}>{groupName || "Group"}</Link>
          <span className="sep">/</span>
          Settle up
        </div>

        <div className="settle-header-row" style={{ marginTop: "0.5rem" }}>
          <Link href={`/groups/${id}`} aria-label="Back to group" className="settle-back-btn">
            ←
          </Link>
          <h1 className="text-gradient settle-title">Settle up</h1>
          <RefreshButton onRefresh={refreshAll} label="Refreshing settlement info" />
        </div>

        {/* Active recurring templates */}
        {recurringTemplates.filter((t) => t.active).length > 0 && (
          <div className="settle-card">
            <p className="settle-card-label">Upcoming recurring charges</p>
            {recurringTemplates
              .filter((t) => t.active)
              .map((t) => (
                <div key={t.id} className="settle-recurring-row">
                  <span className="name">{t.description}</span>
                  <span className="meta">
                    ₹{(t.amountPaise / 100).toFixed(2)}
                    {t.nextRunAt && ` · next run ${new Date(t.nextRunAt).toLocaleDateString()}`}
                  </span>
                </div>
              ))}
          </div>
        )}

        {!initialLoading && suggestions.length === 0 && (
          <div className="settle-empty">🎉 Everyone is settled up!</div>
        )}

        {/* ── Suggested payments ── */}
        {suggestions.length > 0 && (
          <div className="settle-suggestions">
            {suggestions.map((s, i) => {
              const isPayer = currentUserId === s.fromUserId;
              const isPayee = currentUserId === s.toUserId;
              const pending = pendingSettlementFor(s.fromUserId, s.toUserId);
              const isReminding = remindingIndex === i;

              return (
                <div key={i} className="settle-row">
                  <div className="settle-row-label">
                    <div className="settle-row-sub">{isPayer ? "You owe" : `${s.fromName} owes`}</div>
                    <div className="settle-row-name">{s.toName}</div>
                    {!s.toUpiId && (
                      <div className="settle-row-warning">No UPI ID added — cash only</div>
                    )}
                    {isPayee && !pending && (
                      <button onClick={() => sendReminder(i, s)} disabled={isReminding} className="settle-remind-btn">
                        {isReminding ? <Spinner size={11} /> : `📩 Remind ${s.fromName}`}
                      </button>
                    )}
                  </div>

                  <div className="settle-row-actions">
                    <span className="settle-row-amount">₹{(s.amountPaise / 100).toFixed(2)}</span>

                    {pending ? (
                      <span className="settle-pending-badge">🕐 Pending confirmation</span>
                    ) : isPayer ? (
                      <button onClick={() => setPayDialog({ index: i, mode: "pay" })} className="settle-pay-btn">
                        Pay
                      </button>
                    ) : (
                      <button onClick={() => setPayDialog({ index: i, mode: "view" })} className="settle-view-btn">
                        View
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pay / View dialog ── */}
        {activeSuggestion && activeIndex != null && (
          <div onClick={closePayDialog} className="settle-modal-overlay">
            <div onClick={(e) => e.stopPropagation()} className="settle-modal">
              <div className="settle-modal-header">
                <span className="settle-modal-title">
                  {isPayMode ? `Pay ${activeSuggestion.toName}` : `${activeSuggestion.fromName} → ${activeSuggestion.toName}`}
                </span>
                <button onClick={closePayDialog} aria-label="Close" className="settle-modal-close">
                  ✕
                </button>
              </div>

              <div className="settle-modal-body">
                <div className="settle-amount-block">
                  <div className="settle-amount-label">{isPayMode ? "Amount to pay" : "Amount owed"}</div>
                  <div className="settle-amount-value">
                    ₹
                    {(
                      (partialAmounts[activeIndex]
                        ? parseFloat(partialAmounts[activeIndex]) * 100
                        : activeSuggestion.amountPaise) / 100
                    ).toFixed(2)}
                  </div>

                  {isPayMode &&
                    (!showPartialInput[activeIndex] ? (
                      <button
                        onClick={() => setShowPartialInput((p) => ({ ...p, [activeIndex]: true }))}
                        className="settle-partial-toggle"
                      >
                        Pay a different amount
                      </button>
                    ) : (
                      <div className="settle-partial-row">
                        <input
                          type="number"
                          autoFocus
                          placeholder={`up to ${(activeSuggestion.amountPaise / 100).toFixed(2)}`}
                          value={partialAmounts[activeIndex] || ""}
                          onChange={(e) => handlePartialChange(activeIndex, e.target.value, activeSuggestion)}
                          className="settle-partial-input"
                        />
                        <button
                          onClick={() => {
                            setPartialAmounts((p) => ({ ...p, [activeIndex]: "" }));
                            setShowPartialInput((p) => ({ ...p, [activeIndex]: false }));
                            generateQr(activeIndex, activeSuggestion);
                          }}
                          className="settle-partial-full-btn"
                        >
                          Full
                        </button>
                      </div>
                    ))}
                </div>

                <div className="settle-method-toggle">
                  {(["upi", "cash"] as const).map((m) => {
                    const active = (paymentMethods[activeIndex] || "upi") === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setPaymentMethods({ ...paymentMethods, [activeIndex]: m })}
                        className={`settle-method-btn${active ? " active" : ""}`}
                      >
                        {m === "upi" ? "📱 UPI" : "💵 Cash"}
                      </button>
                    );
                  })}
                </div>

                {(paymentMethods[activeIndex] || "upi") === "upi" && (
                  <>
                    {activeSuggestion.toUpiId ? (
                      <div className="settle-qr-block">
                        {qrCodes[activeIndex] ? (
                          <img src={qrCodes[activeIndex]} alt="UPI QR" width={168} height={168} className="settle-qr-image" />
                        ) : (
                          <div className="settle-qr-placeholder">
                            <Spinner size={22} />
                          </div>
                        )}
                        
                         <a href={`upi://pay?pa=${activeSuggestion.toUpiId}&pn=${encodeURIComponent(activeSuggestion.toName)}&am=${(
                            (partialAmounts[activeIndex] ? parseFloat(partialAmounts[activeIndex]) * 100 : activeSuggestion.amountPaise) / 100
                          ).toFixed(2)}&cu=INR&tn=Settlement`}
                          className="settle-upi-link"
                        >
                          Open in UPI app →
                        </a>
                        <p className="settle-qr-note">
                          {isPayMode ? "Scan with any UPI app, or tap above on mobile" : `This is the QR code ${activeSuggestion.fromName} will scan to pay`}
                        </p>
                      </div>
                    ) : (
                      <div className="settle-no-upi-note">
                        {activeSuggestion.toName} hasn't added a UPI ID yet — {isPayMode ? "pick Cash instead, or ask them to add one." : "cash only until they add one."}
                      </div>
                    )}
                  </>
                )}

                {isPayMode ? (
                  <button
                    onClick={() => recordSettlement(activeIndex, activeSuggestion)}
                    disabled={markingPaidIndex === activeIndex}
                    className="settle-mark-paid-btn"
                  >
                    {markingPaidIndex === activeIndex ? <Spinner /> : "Mark as paid"}
                  </button>
                ) : (
                  <p className="settle-view-only-note">Only {activeSuggestion.fromName} can mark this as paid.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── UTR entry dialog ── */}
        {utrDialogSettlementId && (
          <div onClick={skipUtrDialog} className="settle-modal-overlay" style={{ zIndex: 2900 }}>
            <div onClick={(e) => e.stopPropagation()} className="settle-modal" style={{ padding: "1.25rem" }}>
              <h3 className="settle-utr-title">Add UTR number</h3>
              <p className="settle-utr-sub">Recommended as payment proof, so both sides can confirm.</p>
              <p className="settle-utr-hint">Find it in your UPI app under transaction history — looks like: HDFC000123456</p>

              <input
                type="text"
                autoFocus
                placeholder="e.g. HDFC000123456"
                maxLength={12}
                value={utrInputs[utrDialogSettlementId] || ""}
                onChange={(e) => {
                  setUtrInputs((prev) => ({ ...prev, [utrDialogSettlementId!]: e.target.value.toUpperCase() }));
                  setUtrErrors((prev) => ({ ...prev, [utrDialogSettlementId!]: "" }));
                }}
                disabled={savingUtr === utrDialogSettlementId}
                className="settle-utr-input"
              />
              {utrErrors[utrDialogSettlementId] && (
                <p className="settle-utr-error">{utrErrors[utrDialogSettlementId]}</p>
              )}

              <div className="settle-utr-actions">
                <button onClick={skipUtrDialog} className="settle-utr-skip-btn">
                  Skip for now
                </button>
                <button
                  onClick={handleUtrDialogSubmit}
                  disabled={savingUtr === utrDialogSettlementId || !utrInputs[utrDialogSettlementId]}
                  className="settle-utr-save-btn"
                >
                  {savingUtr === utrDialogSettlementId ? <Spinner /> : "Save UTR"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Settlement history ── */}
        <p className="settle-section-label">Settlement history</p>
        {!initialLoading && history.length === 0 && <p className="settle-history-empty">No settlements recorded yet.</p>}

        {history.length > 0 && (
          <div className="settle-history-grid">
            {history.map((h) => {
              const isPayer = h.fromUserId === currentUserId;
              const canSeeUtrInput =
                isPayer && h.paymentMethod === "upi" && !h.utrNumber && h.status !== "both_confirmed";
              const isConfirming = confirmingId === h.id;
              const isDisputing = disputingId === h.id;
              const isSavingUtr = savingUtr === h.id;
              const isResolving = resolving?.id === h.id;
              const myConfirmed = isPayer ? !!h.payerConfirmedAt : !!h.payeeConfirmedAt;
              const waitingOnName = isPayer ? h.toName : h.fromName;

              const statusClass =
                h.status === "both_confirmed" ? "status-settled" : h.status === "disputed" ? "status-disputed" : "status-pending";
              const statusLabel =
                h.status === "both_confirmed" ? "✓ Settled" :
                h.status === "payer_confirmed" ? "⏳ Payer confirmed" :
                h.status === "payee_confirmed_first" ? "⏳ Payee confirmed" :
                h.status === "disputed" ? "⚠ Disputed" : "🕐 Pending";

              return (
                <div key={h.id} className="settle-history-card">
                  <div className="settle-history-head">
                    <div>
                      <span className="settle-history-names">{h.fromName} → {h.toName}</span>
                      <span className="settle-history-amount">₹{(h.amountPaise / 100).toFixed(2)}</span>
                    </div>
                    <div className="settle-history-badges">
                      <span className={`settle-badge method-${h.paymentMethod}`}>
                        {h.paymentMethod === "cash" ? "💵 Cash" : "📱 UPI"}
                      </span>
                      <span className={`settle-badge ${statusClass}`}>{statusLabel}</span>
                    </div>
                  </div>

                  {h.utrNumber && (
                    <div className="settle-utr-box">
                      <span className="label">🔑 UTR:</span>
                      <code>{h.utrNumber}</code>
                      <span className="saved-tag">(reference saved)</span>
                    </div>
                  )}

                  {canSeeUtrInput && (
                    <div className="settle-inline-form">
                      <p className="settle-inline-hint">
                        Add UTR — find it in your UPI app's transaction history (e.g. HDFC000123456)
                      </p>
                      <div className="settle-inline-row">
                        <input
                          type="text"
                          placeholder="e.g. HDFC000123456"
                          maxLength={12}
                          value={utrInputs[h.id] || ""}
                          onChange={(e) => {
                            setUtrInputs((prev) => ({ ...prev, [h.id]: e.target.value.toUpperCase() }));
                            setUtrErrors((prev) => ({ ...prev, [h.id]: "" }));
                          }}
                          disabled={isSavingUtr}
                          className="settle-inline-input"
                        />
                        <button onClick={() => saveUtr(h.id)} disabled={isSavingUtr || !utrInputs[h.id]} className="settle-mini-btn">
                          {isSavingUtr ? <Spinner /> : "Save"}
                        </button>
                      </div>
                      {utrErrors[h.id] && <span className="settle-mini-error">{utrErrors[h.id]}</span>}
                      {utrSaved[h.id] && <span className="settle-mini-success">✓ Saved</span>}
                    </div>
                  )}

                  {h.status === "disputed" && (
                    <div className="settle-dispute-box">
                      {h.disputeReason && <span className="settle-dispute-reason">⚠ {h.disputeReason}</span>}
                      <div className="settle-dispute-actions">
                        <button onClick={() => reopenSettlement(h)} disabled={isResolving} className="settle-mini-btn">
                          {isResolving && resolving?.action === "reopen" ? <Spinner /> : "🔄 Reopen"}
                        </button>
                        {h.toUserId === currentUserId && (
                          <button onClick={() => forgiveSettlement(h)} disabled={isResolving} className="settle-mini-btn">
                            {isResolving && resolving?.action === "forgive" ? <Spinner /> : "✓ Mark resolved anyway"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {h.arbitratedAt && (
                    <div className="settle-arbitration-box">
                      <p className="head">⚖ Resolved by admin in favor of {h.arbitrationDecision === "payer" ? h.fromName : h.toName}</p>
                      <p className="note">{h.arbitrationNote}</p>
                    </div>
                  )}

                  {h.status !== "both_confirmed" && h.status !== "disputed" && (
                    <div className="settle-card-actions">
                      {myConfirmed ? (
                        <span className="settle-waiting-text">⏳ Waiting for {waitingOnName}</span>
                      ) : (
                        <button onClick={() => confirmSettlement(h)} disabled={isConfirming || isDisputing} className="settle-mini-btn">
                          {isConfirming ? <Spinner /> : isPayer ? "Confirm I paid" : "Confirm received"}
                        </button>
                      )}

                      {!isPayer && !myConfirmed && (
                        <button
                          onClick={() => quickDispute(h.id, "Didn't receive money")}
                          disabled={isConfirming || isDisputing}
                          className="settle-not-received-btn"
                        >
                          {isDisputing ? <Spinner /> : "❌ Not received"}
                        </button>
                      )}

                      <button
                        onClick={() => disputeSettlement(h.id)}
                        disabled={isConfirming || isDisputing}
                        className="settle-report-link"
                      >
                        Report issue
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}