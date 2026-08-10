"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import { useModal } from "@/components/ModalProvider";

export default function SettlePage() {
  const { id } = useParams();
  const { confirm, prompt } = useModal();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [showPartialInput, setShowPartialInput] = useState<Record<number, boolean>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});
  const [utrErrors, setUtrErrors] = useState<Record<string, string>>({});
  const [savingUtr, setSavingUtr] = useState<string | null>(null);
  const [utrSaved, setUtrSaved] = useState<Record<string, boolean>>({});

  // Which suggestion's dialog is open, and whether it's the full "pay" flow
  // (shown to the payer) or a read-only "view" (shown to the payee).
  const [payDialog, setPayDialog] = useState<{ index: number; mode: "pay" | "view" } | null>(null);

  // Settlement id for the "enter UTR now" dialog shown right after a UPI payment is recorded
  const [utrDialogSettlementId, setUtrDialogSettlementId] = useState<string | null>(null);

  // Loading states — initial page load, plus one per in-flight action
  const [initialLoading, setInitialLoading] = useState(true);
  const [markingPaidIndex, setMarkingPaidIndex] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  // Tracks an in-flight reopen/forgive action on a disputed settlement
  const [resolving, setResolving] = useState<{ id: string; action: "reopen" | "forgive" } | null>(null);
  // Tracks an in-flight "send reminder" action, keyed by suggestion index
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

  const refreshAll = useCallback(async () => {
    await Promise.all([loadMe(), loadSuggestions(), loadHistory()]);
  }, [loadMe, loadSuggestions, loadHistory]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
  }, [refreshAll]);

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

  // Is there already a settlement between this exact payer/payee pair that has
  // *proof of payment* attached — a UTR for UPI, or just "marked as paid" for cash
  // (cash has no proof step). We only lock the Pay/View button once that proof
  // exists, not the moment "Mark as paid" is clicked, so the payer isn't blocked
  // out mid-flow before they've entered their UTR.
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
      await loadHistory(); // settlement now visible in history immediately, and Pay button locks

      if (paymentMethod === "upi") {
        // Prompt for UTR right away instead of burying it in the history list
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
      // Refresh both — once both sides confirm, the underlying balance should
      // shift and this debt may drop out of `suggestions` entirely.
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

  // One-click dispute with a preset reason — no typing required. Used for the
  // common case ("I didn't receive this money") so the receiver doesn't have
  // to write anything out.
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

  // Resets a disputed settlement back to pending so the payer can retry.
  // Either side can do this — it's a mutual "let's just redo this" action.
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

  // Only the payee can forgive — settles it as both_confirmed despite the
  // disagreement. Requires typing a reason so there's a record of why.
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

  // Sends a nudge email to whoever owes money on this suggestion. Only shown
  // to the payee (the person who's owed), and only while nothing is already
  // pending confirmation for that pair. The server independently recomputes
  // the real debt and enforces a cooldown — this button just triggers it.
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
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={initialLoading} label="Loading settle up" />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href={`/groups/${id}`}
          aria-label="Back to group"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid #2a2a2a",
            background: "#141414",
            color: "#ccc",
            textDecoration: "none",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>Settle up</h1>
        <RefreshButton onRefresh={refreshAll} label="Refreshing settlement info" />
      </div>

      {!initialLoading && suggestions.length === 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "20px 16px",
            textAlign: "center",
            border: "1px solid #2a2a2a",
            borderRadius: 10,
            background: "#141414",
            color: "#86efac",
            fontSize: 14,
          }}
        >
          🎉 Everyone is settled up!
        </div>
      )}

      {/* ── Suggested payments — clean summary rows, no inline form/QR ── */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {suggestions.map((s, i) => {
            const isPayer = currentUserId === s.fromUserId;
            const isPayee = currentUserId === s.toUserId;
            const pending = pendingSettlementFor(s.fromUserId, s.toUserId);
            const isReminding = remindingIndex === i;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  border: "1px solid #2a2a2a",
                  borderRadius: 10,
                  background: "#141414",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 2 }}>
                    {isPayer ? "You owe" : `${s.fromName} owes`}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#eee", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.toName}
                  </div>
                  {!s.toUpiId && (
                    <div style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 3 }}>
                      No UPI ID added — cash only
                    </div>
                  )}
                  {isPayee && !pending && (
                    <button
                      onClick={() => sendReminder(i, s)}
                      disabled={isReminding}
                      style={{
                        marginTop: 6,
                        background: "transparent",
                        border: "none",
                        color: "#f59e0b",
                        fontSize: 12,
                        cursor: isReminding ? "default" : "pointer",
                        padding: 0,
                        opacity: isReminding ? 0.7 : 1,
                      }}
                    >
                      {isReminding ? <Spinner size={11} /> : `📩 Remind ${s.fromName}`}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#eee" }}>
                    ₹{(s.amountPaise / 100).toFixed(2)}
                  </span>

                  {pending ? (
                    <span
                      style={{
                        fontSize: 11.5,
                        color: "#a8a29e",
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "6px 10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🕐 Pending confirmation
                    </span>
                  ) : isPayer ? (
                    <button
                      onClick={() => setPayDialog({ index: i, mode: "pay" })}
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Pay
                    </button>
                  ) : (
                    <button
                      onClick={() => setPayDialog({ index: i, mode: "view" })}
                      style={{
                        background: "transparent",
                        color: "#93c5fd",
                        border: "1px solid #2563eb",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pay / View dialog — same content, action button only shown in "pay" mode ── */}
      {activeSuggestion && activeIndex != null && (
        <div
          onClick={closePayDialog}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2800,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(400px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 12,
              border: "1px solid #333",
              boxShadow: "0 16px 50px rgba(0,0,0,0.6)",
              background: "#161616",
            }}
          >
            {/* Title bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)",
                borderBottom: "1px solid #2a2a2a",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: "#eee" }}>
                {isPayMode ? `Pay ${activeSuggestion.toName}` : `${activeSuggestion.fromName} → ${activeSuggestion.toName}`}
              </span>
              <button
                onClick={closePayDialog}
                aria-label="Close"
                style={{ background: "transparent", border: "none", color: "#888", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 18 }}>
              {/* Big amount */}
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                  {isPayMode ? "Amount to pay" : "Amount owed"}
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: "#eee" }}>
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
                      style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: 12.5, cursor: "pointer", marginTop: 6, padding: 0 }}
                    >
                      Pay a different amount
                    </button>
                  ) : (
                    <div style={{ marginTop: 10, display: "flex", gap: 6, justifyContent: "center" }}>
                      <input
                        type="number"
                        autoFocus
                        placeholder={`up to ${(activeSuggestion.amountPaise / 100).toFixed(2)}`}
                        value={partialAmounts[activeIndex] || ""}
                        onChange={(e) => handlePartialChange(activeIndex, e.target.value, activeSuggestion)}
                        style={{
                          width: 160,
                          textAlign: "center",
                          background: "#0f0f0f",
                          border: "1px solid #333",
                          borderRadius: 6,
                          padding: "6px 8px",
                          color: "#eee",
                          fontSize: 14,
                        }}
                      />
                      <button
                        onClick={() => {
                          setPartialAmounts((p) => ({ ...p, [activeIndex]: "" }));
                          setShowPartialInput((p) => ({ ...p, [activeIndex]: false }));
                          generateQr(activeIndex, activeSuggestion);
                        }}
                        style={{ background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#ccc", fontSize: 12.5, padding: "0 10px", cursor: "pointer" }}
                      >
                        Full
                      </button>
                    </div>
                  ))}
              </div>

              {/* Payment method segmented toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {(["upi", "cash"] as const).map((m) => {
                  const active = (paymentMethods[activeIndex] || "upi") === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setPaymentMethods({ ...paymentMethods, [activeIndex]: m })}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: 8,
                        border: active ? "1px solid #2563eb" : "1px solid #333",
                        background: active ? "rgba(37,99,235,0.15)" : "transparent",
                        color: active ? "#93c5fd" : "#999",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {m === "upi" ? "📱 UPI" : "💵 Cash"}
                    </button>
                  );
                })}
              </div>

              {/* UPI: QR code */}
              {(paymentMethods[activeIndex] || "upi") === "upi" && (
                <>
                  {activeSuggestion.toUpiId ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                        padding: 16,
                        background: "#0f0f0f",
                        border: "1px solid #2a2a2a",
                        borderRadius: 10,
                        marginBottom: 16,
                      }}
                    >
                      {qrCodes[activeIndex] ? (
                        <img src={qrCodes[activeIndex]} alt="UPI QR" width={168} height={168} style={{ borderRadius: 8, background: "#fff", padding: 8 }} />
                      ) : (
                        <div style={{ width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Spinner size={22} />
                        </div>
                      )}
                      <a
                        href={`upi://pay?pa=${activeSuggestion.toUpiId}&pn=${encodeURIComponent(activeSuggestion.toName)}&am=${(
                          (partialAmounts[activeIndex] ? parseFloat(partialAmounts[activeIndex]) * 100 : activeSuggestion.amountPaise) / 100
                        ).toFixed(2)}&cu=INR&tn=Settlement`}
                        style={{
                          display: "inline-block",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#93c5fd",
                          textDecoration: "none",
                          border: "1px solid #2563eb",
                          borderRadius: 6,
                          padding: "7px 16px",
                        }}
                      >
                        Open in UPI app →
                      </a>
                      <p style={{ margin: 0, fontSize: 11.5, color: "#666", textAlign: "center" }}>
                        {isPayMode ? "Scan with any UPI app, or tap above on mobile" : `This is the QR code ${activeSuggestion.fromName} will scan to pay`}
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#1a1508",
                        border: "1px solid #78350f",
                        borderRadius: 8,
                        color: "#fbbf24",
                        fontSize: 12.5,
                        marginBottom: 16,
                      }}
                    >
                      {activeSuggestion.toName} hasn't added a UPI ID yet — {isPayMode ? "pick Cash instead, or ask them to add one." : "cash only until they add one."}
                    </div>
                  )}
                </>
              )}

              {isPayMode ? (
                <button
                  onClick={() => recordSettlement(activeIndex, activeSuggestion)}
                  disabled={markingPaidIndex === activeIndex}
                  style={{
                    width: "100%",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "12px 0",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: markingPaidIndex === activeIndex ? "default" : "pointer",
                    opacity: markingPaidIndex === activeIndex ? 0.7 : 1,
                  }}
                >
                  {markingPaidIndex === activeIndex ? <Spinner /> : "Mark as paid"}
                </button>
              ) : (
                <p style={{ margin: 0, textAlign: "center", fontSize: 12.5, color: "#666" }}>
                  Only {activeSuggestion.fromName} can mark this as paid.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── UTR entry dialog — shown right after a UPI payment is recorded ── */}
      {utrDialogSettlementId && (
        <div
          onClick={skipUtrDialog}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2900,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(400px, 100%)",
              borderRadius: 12,
              border: "1px solid #333",
              boxShadow: "0 16px 50px rgba(0,0,0,0.6)",
              background: "#161616",
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "#eee" }}>Add UTR number</h3>
            <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "#888" }}>
              Recommended as payment proof, so both sides can confirm.
            </p>
            <p style={{ fontSize: 11, color: "#555", margin: "0 0 12px" }}>
              Find it in your UPI app under transaction history — looks like: HDFC000123456
            </p>

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
              style={{
                width: "100%",
                fontFamily: "monospace",
                letterSpacing: 2,
                textTransform: "uppercase",
                background: "#0f0f0f",
                border: "1px solid #333",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#eee",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
            {utrErrors[utrDialogSettlementId] && (
              <p style={{ color: "#f87171", fontSize: 12, margin: "6px 0 0" }}>{utrErrors[utrDialogSettlementId]}</p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={skipUtrDialog}
                style={{ flex: 1, background: "transparent", border: "1px solid #444", borderRadius: 8, color: "#ccc", fontSize: 13, padding: "10px 0", cursor: "pointer" }}
              >
                Skip for now
              </button>
              <button
                onClick={handleUtrDialogSubmit}
                disabled={savingUtr === utrDialogSettlementId || !utrInputs[utrDialogSettlementId]}
                style={{
                  flex: 1,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "10px 0",
                  cursor: savingUtr === utrDialogSettlementId ? "default" : "pointer",
                  opacity: savingUtr === utrDialogSettlementId ? 0.7 : 1,
                }}
              >
                {savingUtr === utrDialogSettlementId ? <Spinner /> : "Save UTR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settlement history ── */}
      <h2 style={{ fontSize: 17, marginTop: 32 }}>Settlement history</h2>
      {!initialLoading && history.length === 0 && <p style={{ color: "#888", fontSize: 13.5 }}>No settlements recorded yet.</p>}

      {history.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {history.map((h) => {
            const isPayer = h.fromUserId === currentUserId;
            const canSeeUtrInput =
              isPayer &&
              h.paymentMethod === "upi" &&
              !h.utrNumber &&
              h.status !== "both_confirmed";
            const isConfirming = confirmingId === h.id;
            const isDisputing = disputingId === h.id;
            const isSavingUtr = savingUtr === h.id;
            const isResolving = resolving?.id === h.id;
            // Has *my* side already confirmed? Relies on payerConfirmedAt / payeeConfirmedAt
            // being returned by the settlement-history API for each row.
            const myConfirmed = isPayer ? !!h.payerConfirmedAt : !!h.payeeConfirmedAt;
            const waitingOnName = isPayer ? h.toName : h.fromName;

            return (
              <div
                key={h.id}
                className="border border-[#2a2a2a] rounded-lg p-3.5 bg-[#141414] flex flex-col gap-2.5 min-w-0 overflow-hidden"
              >
                {/* Header row */}
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-[#eee] break-words">
                      {h.fromName} → {h.toName}
                    </span>
                    <span className="ml-2 text-[#888] text-[13px]">
                      ₹{(h.amountPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded ${
                        h.paymentMethod === "cash"
                          ? "bg-[#451a03] text-[#fb923c]"
                          : "bg-[#172554] text-[#60a5fa]"
                      }`}
                    >
                      {h.paymentMethod === "cash" ? "💵 Cash" : "📱 UPI"}
                    </span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded ${
                        h.status === "both_confirmed"
                          ? "bg-[#14532d] text-[#86efac]"
                          : h.status === "disputed"
                          ? "bg-[#450a0a] text-[#fca5a5]"
                          : "bg-[#1c1917] text-[#a8a29e]"
                      }`}
                    >
                      {h.status === "both_confirmed" ? "✓ Settled" :
                       h.status === "payer_confirmed" ? "⏳ Payer confirmed" :
                       h.status === "payee_confirmed_first" ? "⏳ Payee confirmed" :
                       h.status === "disputed" ? "⚠ Disputed" : "🕐 Pending"}
                    </span>
                  </div>
                </div>

                {/* Proof / UTR */}
                {h.utrNumber && (
                  <div className="px-2.5 py-1.5 bg-[#0f2937] rounded-md border border-[#164e63] text-[13px] break-all">
                    <span className="text-[#7dd3fc] mr-1.5">🔑 UTR:</span>
                    <code className="text-[#e0f2fe] tracking-wider">{h.utrNumber}</code>
                    <span className="text-[#0e7490] text-[11px] ml-2">(reference saved)</span>
                  </div>
                )}

                {canSeeUtrInput && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-[#555] m-0">
                      Add UTR — find it in your UPI app's transaction history (e.g. HDFC000123456)
                    </p>
                    <div className="flex gap-1.5">
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
                        className="flex-1 min-w-0 font-mono tracking-wider uppercase text-xs px-2 py-1.5 bg-[#0f0f0f] border border-[#333] rounded text-[#eee]"
                      />
                      <button
                        onClick={() => saveUtr(h.id)}
                        disabled={isSavingUtr || !utrInputs[h.id]}
                        className="text-xs px-2.5 py-1.5"
                      >
                        {isSavingUtr ? <Spinner /> : "Save"}
                      </button>
                    </div>
                    {utrErrors[h.id] && <span className="text-[#f87171] text-[11px]">{utrErrors[h.id]}</span>}
                    {utrSaved[h.id] && <span className="text-[#86efac] text-[11px]">✓ Saved</span>}
                  </div>
                )}

                {/* Disputed: reason + resolution actions */}
                {h.status === "disputed" && (
                  <div className="px-2.5 py-1.5 bg-[#2a0a0a] rounded-md border border-[#7f1d1d] flex flex-col gap-2">
                    {h.disputeReason && (
                      <span className="text-[#f87171] text-[13px]">⚠ {h.disputeReason}</span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => reopenSettlement(h)}
                        disabled={isResolving}
                        className="text-xs px-2.5 py-1.5"
                      >
                        {isResolving && resolving?.action === "reopen" ? <Spinner /> : "🔄 Reopen"}
                      </button>
                      {h.toUserId === currentUserId && (
                        <button
                          onClick={() => forgiveSettlement(h)}
                          disabled={isResolving}
                          className="text-xs px-2.5 py-1.5"
                        >
                          {isResolving && resolving?.action === "forgive" ? <Spinner /> : "✓ Mark resolved anyway"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {h.status !== "both_confirmed" && h.status !== "disputed" && (
                  <div className="flex flex-wrap gap-2 items-center pt-1">
                    {myConfirmed ? (
                      <span className="text-[13px] text-[#a8a29e]">
                        ⏳ Waiting for {waitingOnName}
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmSettlement(h)}
                        disabled={isConfirming || isDisputing}
                        className="text-xs px-2.5 py-1.5"
                      >
                        {isConfirming ? <Spinner /> : isPayer ? "Confirm I paid" : "Confirm received"}
                      </button>
                    )}

                    {!isPayer && !myConfirmed && (
                      <button
                        onClick={() => quickDispute(h.id, "Didn't receive money")}
                        disabled={isConfirming || isDisputing}
                        className="bg-transparent border border-[#7f1d1d] rounded-md text-[#fca5a5] text-xs px-2.5 py-1.5 cursor-pointer whitespace-nowrap"
                      >
                        {isDisputing ? <Spinner /> : "❌ Not received"}
                      </button>
                    )}

                    <button
                      onClick={() => disputeSettlement(h.id)}
                      disabled={isConfirming || isDisputing}
                      className="bg-transparent border-0 text-[#f87171] text-xs p-0 cursor-pointer underline whitespace-nowrap"
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
  );
}