"use client";

import { useEffect, useState, useCallback } from "react";

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

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>My payments</h1>
        <button onClick={load} style={{ fontSize: 13 }}>🔄 Refresh</button>
      </div>

      {subscriptions.length === 0 && (
        <p style={{ color: "#888" }}>You haven't paid into any vendor collections yet.</p>
      )}

      {subscriptions.map((sub: any) => (
        <div key={sub.id} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontWeight: 600 }}>{sub.collection.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                {sub.collection.vendor.businessName} · ₹{(sub.collection.amountPaise / 100).toFixed(2)}
              </p>
            </div>
            <span style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 4,
              background: sub.payment?.status === "confirmed" ? "#14532d" : sub.payment?.status === "paid" ? "#451a03" : "#1c1917",
              color: sub.payment?.status === "confirmed" ? "#86efac" : sub.payment?.status === "paid" ? "#fb923c" : "#a8a29e",
            }}>
              {sub.payment?.status === "confirmed" ? "✓ Confirmed" : sub.payment?.status === "paid" ? "⏳ Awaiting confirmation" : "Not paid yet"}
            </span>
          </div>
          {sub.payment?.utrNumber && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>UTR: {sub.payment.utrNumber}</p>
          )}
        </div>
      ))}
    </div>
  );
}