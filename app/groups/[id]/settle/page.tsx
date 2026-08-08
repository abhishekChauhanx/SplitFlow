"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import RefreshButton from "@/components/RefreshButton";
import PageLoader from "@/components/PageLoader";

export default function SettlePage() {
  const { id } = useParams();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Record<number, string>>({});
  const [initialLoading, setInitialLoading] = useState(true);

  async function generateQr(index: number, s: any, amountPaiseOverride?: number) {
    if (!s.toUpiId) return;
    const amountPaise = amountPaiseOverride ?? s.amountPaise;
    const amountRupees = (amountPaise / 100).toFixed(2);
    const upiUrl = `upi://pay?pa=${s.toUpiId}&pn=${encodeURIComponent(s.toName)}&am=${amountRupees}&cu=INR&tn=Settlement`;
    const dataUrl = await QRCode.toDataURL(upiUrl);
    setQrCodes((prev) => ({ ...prev, [index]: dataUrl }));
  }

  const loadSuggestions = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/settlements`);
    const data = await res.json();
    setSuggestions(data);
    data.forEach((s: any, i: number) => generateQr(i, s));
  }, [id]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/settlement-history`);
    const data = await res.json();
    setHistory(data);
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSuggestions(), loadHistory()]);
  }, [loadSuggestions, loadHistory]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => setCurrentUserId(me.userId));
    Promise.all([loadSuggestions(), loadHistory()]).finally(() => setInitialLoading(false));
  }, [id, loadSuggestions, loadHistory]);

  function handlePartialChange(index: number, value: string, s: any) {
    setPartialAmounts({ ...partialAmounts, [index]: value });
    const amountPaise = value ? Math.round(parseFloat(value) * 100) : s.amountPaise;
    if (!isNaN(amountPaise) && amountPaise > 0) {
      generateQr(index, s, amountPaise);
    }
  }

  async function recordSettlement(index: number, s: any) {
    const amountToSend = partialAmounts[index]
      ? Math.round(parseFloat(partialAmounts[index]) * 100)
      : s.amountPaise;

    const paymentMethod = paymentMethods[index] || "upi";

    const res = await fetch(`/api/groups/${id}/settlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: s.toUserId, amountPaise: amountToSend, paymentMethod }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Couldn't record settlement");
      return;
    }

    alert(paymentMethod === "cash"
      ? "Cash payment recorded — ask the recipient to confirm they received it."
      : "UPI payment recorded — both sides need to confirm below."
    );
    loadHistory();
  }

  async function confirm(settlementId: string) {
    await fetch(`/api/settlements/${settlementId}/confirm`, { method: "POST" });
    loadHistory();
  }

  async function dispute(settlementId: string) {
    const reason = prompt("What doesn't match? (e.g. wrong amount)");
    if (!reason) return;
    await fetch(`/api/settlements/${settlementId}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    loadHistory();
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      {initialLoading && <PageLoader label="Loading settlement info" />}

      <Link href={`/groups/${id}`} style={{ fontSize: 14, color: "#888" }}>
        ← Back to group
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <h1 style={{ margin: 0 }}>Settle up</h1>
        <RefreshButton onRefresh={refreshAll} />
      </div>

      {suggestions.length === 0 && <p>Everyone is settled up. 🎉</p>}

      {suggestions.map((s, i) => {
        const isPayer = currentUserId === s.fromUserId;
        return (
          <div key={i} style={{ border: "1px solid #333", padding: 16, marginBottom: 16 }}>
            <p>{s.fromName} owes {s.toName}: ₹{(s.amountPaise / 100).toFixed(2)}</p>

            {!s.toUpiId && (
              <p style={{ color: "orange" }}>
                {s.toName} hasn't added a UPI ID yet — ask them to add one in their profile before settling.
              </p>
            )}

            {s.toUpiId && qrCodes[i] && (
              <>
                <img src={qrCodes[i]} alt="UPI QR code" width={160} height={160} />
              </>
            )}
            {isPayer && (
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#888", marginRight: 8 }}>
                  How are you paying?
                </label>
                <select
                  value={paymentMethods[i] || "upi"}
                  onChange={(e) => setPaymentMethods({ ...paymentMethods, [i]: e.target.value })}
                >
                  <option value="upi">UPI (scan QR or use link)</option>
                  <option value="cash">Cash (in person)</option>
                </select>
              </div>
            )}
            {isPayer ? (
              <div>
                <input
                  placeholder="Partial amount (optional)"
                  type="number"
                  value={partialAmounts[i] || ""}
                  onChange={(e) => handlePartialChange(i, e.target.value, s)}
                />
                <button onClick={() => recordSettlement(i, s)}>Mark as paid</button>
              </div>
            ) : (
              <p style={{ color: "#888" }}>Only {s.fromName} can mark this as paid.</p>
            )}
          </div>
        );
      })}

      <h2>Settlement history</h2>
      <ul>
        {history.map((h) => (
          <li key={h.id} style={{ marginBottom: 12 }}>
            {h.fromName} → {h.toName}: ₹{(h.amountPaise / 100).toFixed(2)} — <strong>{h.status}</strong>
            {h.status !== "both_confirmed" && h.status !== "disputed" && (
              <>
                {" "}
                <button onClick={() => confirm(h.id)}>Confirm my side</button>
                <button onClick={() => dispute(h.id)}>Dispute</button>
              </>
            )}
            {h.status === "disputed" && <span style={{ color: "red" }}> — {h.disputeReason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}