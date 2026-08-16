"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

export default function PayPage() {
  const { token } = useParams();
  const router = useRouter();
  const [collection, setCollection] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/vendor/pay/${token}`)
      .then(async (r) => {
        if (r.status === 401) {
          router.push(`/login?from=/pay/${token}`);
          return null;
        }
        return r.json();
      })
      .then(async (data) => {
        if (!data) return; // redirected to login above

        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        setCollection(data);

        if (data.myPaymentStatus) {
          setDone(true);
          setLoading(false);
          return;
        }

        if (data.vendorUpiId) {
          const amountRupees = (data.amountPaise / 100).toFixed(2);
          const upiUrl = `upi://pay?pa=${data.vendorUpiId}&pn=${encodeURIComponent(data.vendorName)}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(data.title)}`;
          const qr = await QRCode.toDataURL(upiUrl);
          setQrCode(qr);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load this payment link. Please try again.");
        setLoading(false);
      });
  }, [token]);

  async function recordPayment() {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/vendor/pay/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrNumber, paymentMethod }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        setError("Something went wrong on our end — please try again.");
        return;
      }

      if (res.status === 401) {
        router.push(`/login?from=/pay/${token}`);
        return;
      }

      if (!res.ok) {
        setError(data?.error || "Failed to record payment");
        return;
      }

      setDone(true);
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;

  if (error && !collection) {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <p style={{ color: "#f87171" }}>{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 380, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
        <p style={{ fontSize: 48 }}>✅</p>
        <h2>Payment recorded!</h2>
        <p style={{ color: "#888" }}>
          {collection?.vendorName} will confirm receipt once they verify the payment.
        </p>
        <a href="/tenant/dashboard" style={{ color: "#60a5fa", fontSize: 13 }}>
          Go to my payments dashboard →
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px" }}>{collection.title}</h1>
        <p style={{ margin: 0, color: "#888", fontSize: 14 }}>
          Collected by {collection.vendorName}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 700, color: "#86efac" }}>
          ₹{(collection.amountPaise / 100).toFixed(2)}
        </p>
        {collection.dueDate && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#f59e0b" }}>
            Due {new Date(collection.dueDate).toLocaleDateString()}
          </p>
        )}
      </div>

      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, marginBottom: 20, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
          {collection.paidCount} of {collection.subscriberCount} subscribers have paid
        </p>
        <div style={{ background: "#2a2a2a", borderRadius: 4, height: 6, margin: "8px 0 0" }}>
          <div style={{
            background: "#86efac",
            borderRadius: 4,
            height: 6,
            width: collection.subscriberCount > 0
              ? `${(collection.paidCount / collection.subscriberCount) * 100}%`
              : "0%",
          }} />
        </div>
      </div>

      {qrCode && (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={qrCode} alt="UPI QR" width={180} height={180} />
          <p style={{ fontSize: 13, color: "#888", margin: "8px 0 4px" }}>
            Scan to pay via any UPI app
          </p>
          
           <a href={`upi://pay?pa=${collection.vendorUpiId}&pn=${encodeURIComponent(collection.vendorName)}&am=${(collection.amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(collection.title)}`}
            style={{ fontSize: 13, color: "#60a5fa" }}
          >
            Open in UPI app →
          </a>
        </div>
      )}

      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Record your payment</h3>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
            How did you pay?
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="upi">UPI (scanned QR or link)</option>
            <option value="cash">Cash (handed over in person)</option>
          </select>
        </div>

        {paymentMethod === "upi" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
              UTR / reference number (recommended)
            </label>
            <input
              placeholder="12-character code from your UPI app"
              maxLength={12}
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
              style={{ width: "100%", fontFamily: "monospace", letterSpacing: 1 }}
            />
          </div>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}

        <button
          onClick={recordPayment}
          disabled={submitting}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px",
            width: "100%",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {submitting ? "Recording..." : "I've paid — record it"}
        </button>
      </div>
    </div>
  );
}