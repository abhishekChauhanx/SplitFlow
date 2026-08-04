"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";

export default function SettlePage() {
  const { id } = useParams();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<any[]>([]);

  function loadHistory() {
    fetch(`/api/groups/${id}/settlement-history`).then((r) => r.json()).then(setHistory);
  }

  useEffect(() => {
    fetch(`/api/groups/${id}/settlements`).then((r) => r.json()).then(async (data) => {
      setSuggestions(data);
      const codes: Record<number, string> = {};
      for (let i = 0; i < data.length; i++) {
        const s = data[i];
        if (s.toUpiId) {
          const amountRupees = (s.amountPaise / 100).toFixed(2);
          const upiUrl = `upi://pay?pa=${s.toUpiId}&pn=${encodeURIComponent(s.toName)}&am=${amountRupees}&cu=INR&tn=Settlement`;
          codes[i] = await QRCode.toDataURL(upiUrl);
        }
      }
      setQrCodes(codes);
    });
    loadHistory();
  }, [id]);

  async function recordSettlement(index: number, s: any) {
    const amountToSend = partialAmounts[index]
      ? Math.round(parseFloat(partialAmounts[index]) * 100)
      : s.amountPaise;

    await fetch(`/api/groups/${id}/settlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: s.toUserId, amountPaise: amountToSend }),
    });
    alert("Settlement recorded — both sides need to confirm below once payment is made.");
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
      <h1>Settle up</h1>
      {suggestions.length === 0 && <p>Everyone is settled up. 🎉</p>}

      {suggestions.map((s, i) => (
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
              <p>
                <a href={`upi://pay?pa=${s.toUpiId}&pn=${encodeURIComponent(s.toName)}&am=${(s.amountPaise/100).toFixed(2)}&cu=INR&tn=Settlement`}>
                  Pay via UPI app
                </a>
              </p>
            </>
          )}

          <div>
            <input
              placeholder="Partial amount (optional)"
              type="number"
              value={partialAmounts[i] || ""}
              onChange={(e) => setPartialAmounts({ ...partialAmounts, [i]: e.target.value })}
            />
            <button onClick={() => recordSettlement(i, s)}>Mark as paid</button>
          </div>
        </div>
      ))}

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