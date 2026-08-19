"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

export default function KittyJoinPage() {
  const { token } = useParams();
  const router = useRouter();
  const [preview, setPreview] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [utrNumber, setUtrNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/kitty/join/${token}`)
      .then(async (r) => {
        if (r.status === 401) {
          router.push(`/login?from=/kitty/join/${token}`);
          return null;
        }
        return r.json();
      })
      .then(async (data) => {
        if (!data) return;
        if (data.error) { setError(data.error); setLoading(false); return; }

        setPreview(data);

        if (data.myStatus === "paid" || data.myStatus === "confirmed") {
          setDone(true);
          setLoading(false);
          return;
        }

        if (data.myAmountPaise) {
          setAmount((data.myAmountPaise / 100).toString());
        }

        if (data.collectorUpiId) {
          const suggestedAmount = data.myAmountPaise
            ? (data.myAmountPaise / 100).toFixed(2)
            : "";
          const upiUrl = `upi://pay?pa=${data.collectorUpiId}&pn=${encodeURIComponent(data.organizerName)}&${suggestedAmount ? `am=${suggestedAmount}&` : ""}cu=INR&tn=${encodeURIComponent(data.title)}`;
          const qr = await QRCode.toDataURL(upiUrl);
          setQrCode(qr);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load this invite link.");
        setLoading(false);
      });
  }, [token]);

  async function submitContribution() {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter how much you're contributing");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/kitty/join/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaise: Math.round(parseFloat(amount) * 100),
          paymentMethod,
          utrNumber,
        }),
      });

      let data: any = null;
      try { data = await res.json(); } catch {
        setError("Something went wrong. Please try again.");
        return;
      }

      if (res.status === 401) {
        router.push(`/login?from=/kitty/join/${token}`);
        return;
      }

      if (!res.ok) {
        setError(data?.error || "Failed to record your contribution");
        return;
      }

      setDone(true);
    } catch {
      setError("Couldn't reach the server — check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;

  if (error && !preview) {
    return <div style={{ textAlign: "center", marginTop: 80 }}><p style={{ color: "#f87171" }}>{error}</p></div>;
  }

  if (done) {
    return (
      <div style={{ maxWidth: 380, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
        <p style={{ fontSize: 48 }}>✅</p>
        <h2>Contribution recorded!</h2>
        <p style={{ color: "#888" }}>
          {preview?.organizerName} will confirm once they verify your payment.
        </p>
        <a href="/kitty" style={{ color: "#60a5fa", fontSize: 13 }}>Go to collection pools →</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px" }}>{preview.title}</h1>
        {preview.description && (
          <p style={{ margin: "0 0 8px", color: "#888", fontSize: 13 }}>{preview.description}</p>
        )}
        <p style={{ margin: 0, color: "#888", fontSize: 13 }}>Organized by {preview.organizerName}</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>
          Target: ₹{(preview.targetPaise / 100).toFixed(0)} · {preview.paidCount}/{preview.contributorCount} contributed
        </p>
        {preview.deadline && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#f59e0b" }}>
            Deadline: {new Date(preview.deadline).toLocaleDateString()}
          </p>
        )}
      </div>

      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Your contribution</h3>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
            Amount (₹) {preview.myAmountPaise ? "— suggested share" : ""}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              // Regenerate the QR with the actual amount they're entering
            }}
            style={{ width: "100%" }}
          />
        </div>

        {qrCode && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <img src={qrCode} alt="UPI QR" width={160} height={160} />
            <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0" }}>Scan to pay via UPI</p>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>How did you pay?</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: "100%" }}>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        {paymentMethod === "upi" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>UTR / reference number</label>
            <input
              maxLength={12}
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </div>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{error}</p>}

        <button
          onClick={submitContribution}
          disabled={submitting}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "10px", width: "100%", cursor: "pointer" }}
        >
          {submitting ? "Recording..." : "I've contributed — record it"}
        </button>
      </div>
    </div>
  );
}