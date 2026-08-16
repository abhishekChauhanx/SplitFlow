"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";

export default function TenantDashboardPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/tenant/subscriptions");
    if (res.ok) setSubscriptions(await res.json());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function downloadReceipt(receiptId: string) {
    window.open(`/api/rent-receipts/${receiptId}/download`, "_blank");
  }

  const totalPaid = subscriptions.reduce((sum, s) => {
    if (s.payment?.status === "paid" || s.payment?.status === "confirmed") {
      return sum + s.payment.amountPaise;
    }
    return sum;
  }, 0);

  const totalPending = subscriptions.filter((s) => !s.payment).length;

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={loading} label="Loading your payments" />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <BackButton href="/dashboard" />
        <h1 style={{ margin: 0, fontSize: 20 }}>My payments</h1>
        <button onClick={load} style={{ marginLeft: "auto", fontSize: 13 }}>🔄 Refresh</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "16px 0 24px" }}>
        <div style={{ padding: 14, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888" }}>Total paid</p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#86efac" }}>
            ₹{(totalPaid / 100).toFixed(0)}
          </p>
        </div>
        <div style={{ padding: 14, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888" }}>Pending dues</p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: totalPending > 0 ? "#f87171" : "#888" }}>
            {totalPending}
          </p>
        </div>
      </div>

      {subscriptions.length === 0 && (
        <div style={{ padding: 24, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#888", margin: 0 }}>
            You haven't paid into any vendor collections yet. Ask your landlord or mess vendor for their collection link.
          </p>
        </div>
      )}

      {subscriptions.map((sub) => {
        const payment = sub.payment;
        const receipt = payment?.rentReceipt;

        return (
          <div key={sub.id} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontWeight: 600 }}>{sub.collection.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                  {sub.collection.vendor.businessName} · ₹{(sub.collection.amountPaise / 100).toFixed(2)}
                  {sub.collection.dueDate && ` · Due ${new Date(sub.collection.dueDate).toLocaleDateString()}`}
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  background:
                    payment?.status === "confirmed" ? "#14532d" :
                    payment?.status === "paid" ? "#451a03" : "#1c1917",
                  color:
                    payment?.status === "confirmed" ? "#86efac" :
                    payment?.status === "paid" ? "#fb923c" : "#a8a29e",
                }}
              >
                {payment?.status === "confirmed" ? "✓ Confirmed" :
                 payment?.status === "paid" ? "⏳ Awaiting confirmation" :
                 "Not paid yet"}
              </span>
            </div>

            {payment?.utrNumber && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
                UTR: <code>{payment.utrNumber}</code>
              </p>
            )}

            {!payment && (
              <Link
                href={`/pay/${sub.collection.token}`}
                style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#60a5fa" }}
              >
                → Pay now
              </Link>
            )}

            {receipt && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: receipt.status === "signed" ? "#14532d" : "#451a03",
                    color: receipt.status === "signed" ? "#86efac" : "#fb923c",
                  }}
                >
                  {receipt.status === "signed" ? "🧾 Receipt signed" : "🧾 Receipt awaiting landlord signature"}
                </span>
                <button onClick={() => downloadReceipt(receipt.id)} style={{ fontSize: 12 }}>
                  ⬇ Download
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}