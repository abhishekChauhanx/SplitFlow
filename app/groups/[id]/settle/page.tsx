"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function SettlePage() {
  const { id } = useParams();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});

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
    alert("Settlement recorded as pending — confirm once the payment is actually made.");
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
    </div>
  );
}