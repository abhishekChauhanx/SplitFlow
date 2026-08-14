"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ReceiptsPage() {
  const [data, setData] = useState<{ asTenant: any[]; asLandlord: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/rent-receipts")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  async function sign(receiptId: string) {
    if (!confirm("Confirm you're digitally signing this rent receipt? This cannot be undone.")) return;
    await fetch(`/api/rent-receipts/${receiptId}/sign`, { method: "POST" });
    load();
  }

  function download(receiptId: string) {
    window.open(`/api/rent-receipts/${receiptId}/download`, "_blank");
  }

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
      <Link href="/dashboard" style={{ fontSize: 13, color: "#888" }}>← Back to dashboard</Link>
      <h1 style={{ marginTop: 8 }}>Rent receipts</h1>

      {/* ── As tenant ── */}
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginTop: 24 }}>
        My rent receipts (as tenant)
      </h2>

      {data?.asTenant.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>
          No rent receipts yet. Generate one from a confirmed settlement.
        </p>
      )}

      {data?.asTenant.map((r) => (
        <div key={r.id} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
                ₹{(r.amountPaise / 100).toFixed(2)} — {r.landlord.name}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                {r.propertyAddress}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#666" }}>
                {new Date(r.paymentPeriodFrom).toLocaleDateString()} – {new Date(r.paymentPeriodTo).toLocaleDateString()}
              </p>
            </div>
            <span style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 4,
              background: r.status === "signed" ? "#14532d" : "#451a03",
              color: r.status === "signed" ? "#86efac" : "#fb923c",
              whiteSpace: "nowrap",
            }}>
              {r.status === "signed" ? "✓ Signed" : "⏳ Awaiting signature"}
            </span>
          </div>
          <button
            onClick={() => download(r.id)}
            style={{ marginTop: 10, fontSize: 12 }}
          >
            ⬇ Download PDF
          </button>
        </div>
      ))}

      {/* ── As landlord ── */}
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginTop: 32 }}>
        Receipts to sign (as landlord)
      </h2>

      {data?.asLandlord.length === 0 && (
        <p style={{ color: "#888", fontSize: 13 }}>No receipts pending your signature.</p>
      )}

      {data?.asLandlord.map((r) => (
        <div key={r.id} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
                ₹{(r.amountPaise / 100).toFixed(2)} — from {r.tenant.name}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                {r.propertyAddress}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#666" }}>
                {new Date(r.paymentPeriodFrom).toLocaleDateString()} – {new Date(r.paymentPeriodTo).toLocaleDateString()}
              </p>
            </div>
            <span style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 4,
              background: r.status === "signed" ? "#14532d" : "#451a03",
              color: r.status === "signed" ? "#86efac" : "#fb923c",
              whiteSpace: "nowrap",
            }}>
              {r.status === "signed" ? "✓ Signed" : "⏳ Needs signature"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => download(r.id)} style={{ fontSize: 12 }}>
              ⬇ Preview PDF
            </button>
            {r.status !== "signed" && (
              <button
                onClick={() => sign(r.id)}
                style={{ fontSize: 12, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
              >
                ✓ Sign this receipt
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}