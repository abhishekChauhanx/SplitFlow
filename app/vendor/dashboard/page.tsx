"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";

export default function VendorDashboardPage() {
  const router = useRouter();
  const { confirm } = useModal();
  const [vendor, setVendor] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [navLabel, setNavLabel] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/vendor/register");
    const data = await res.json();
    if (!data || data.error) {
      router.push("/vendor/register");
      return;
    }
    setVendor(data);
  }

  useEffect(() => {
    load().finally(() => setInitialLoading(false));
  }, []);

  function goToNewCollection() {
    setNavLabel("Loading new collection");
    router.push("/vendor/collection/new");
  }

  async function deleteCollection(c: any) {
    const ok = await confirm({
      title: "Delete collection?",
      message: `Delete "${c.title}"? This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/vendor/collections/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        await confirm({
          title: "Can't delete",
          message: data.error || "Failed to delete this collection.",
          mode: "alert",
        });
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  const overlayVisible = initialLoading || !!navLabel || !!deletingId;
  const overlayLabel = deletingId
    ? "Deleting collection"
    : navLabel || "Loading vendor dashboard";

  if (!vendor) {
    return <SFLoaderOverlay visible={overlayVisible} label={overlayLabel} />;
  }

  const totalCollected = vendor.collections.reduce((sum: number, c: any) => {
    const paid = c.subscribers.filter((s: any) =>
      s.payment?.status === "paid" || s.payment?.status === "confirmed"
    ).length;
    return sum + paid * c.amountPaise;
  }, 0);

  const totalExpected = vendor.collections.reduce((sum: number, c: any) =>
    sum + c.subscribers.length * c.amountPaise, 0
  );

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={overlayVisible} label={overlayLabel} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <BackButton href="/dashboard" />
          <div>
            <h1 style={{ margin: 0 }}>{vendor.businessName}</h1>
            <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
              {vendor.businessType} · {vendor.upiId || "No UPI ID set"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RefreshButton onRefresh={load} label="Refreshing vendor dashboard" />
          <button
            onClick={goToNewCollection}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
          >
            + New collection
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total expected", value: `₹${(totalExpected / 100).toFixed(0)}`, color: "#fff" },
          { label: "Collected", value: `₹${(totalCollected / 100).toFixed(0)}`, color: "#86efac" },
          { label: "Pending", value: `₹${((totalExpected - totalCollected) / 100).toFixed(0)}`, color: "#f87171" },
        ].map((card) => (
          <div key={card.label} style={{ padding: 14, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888" }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Collections list */}
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
        Collections
      </h2>

      {vendor.collections.length === 0 && (
        <div style={{ padding: 24, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#888", margin: 0 }}>No collections yet.</p>
          <button
            onClick={goToNewCollection}
            style={{ marginTop: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
          >
            Create your first collection
          </button>
        </div>
      )}

      {vendor.collections.map((c: any) => {
        const total = c.subscribers.length;
        const paid = c.subscribers.filter((s: any) =>
          s.payment?.status === "paid" || s.payment?.status === "confirmed"
        ).length;
        const hasAnyPaid = c.subscribers.some((s: any) => !!s.payment);
        const collectionUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${c.token}`;

        return (
          <div key={c.id} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, marginBottom: 16 }}>

            {/* Collection header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 16 }}>{c.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                  ₹{(c.amountPaise / 100).toFixed(0)} per person
                  {c.dueDate && ` · Due ${new Date(c.dueDate).toLocaleDateString()}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Link href={`/vendor/collection/${c.id}/edit`} style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>
                  Edit
                </Link>
                <button
                  onClick={() => deleteCollection(c)}
                  disabled={hasAnyPaid}
                  title={hasAnyPaid ? "Can't delete — payments already recorded" : "Delete collection"}
                  style={{
                    fontSize: 11,
                    color: hasAnyPaid ? "#555" : "#f87171",
                    background: "none",
                    border: "none",
                    cursor: hasAnyPaid ? "not-allowed" : "pointer",
                    marginTop: 2,
                    padding: 0,
                  }}
                >
                  Delete
                </button>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700, color: "#86efac" }}>
                    {paid}/{total}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#888" }}>paid</p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: "#2a2a2a", borderRadius: 4, height: 6, marginBottom: 12 }}>
              <div style={{
                background: "#86efac",
                borderRadius: 4,
                height: 6,
                width: total > 0 ? `${(paid / total) * 100}%` : "0%",
                transition: "width 0.3s",
              }} />
            </div>

            {/* Subscriber list */}
            <div style={{ marginBottom: 12 }}>
              {c.subscribers.map((s: any) => {
                const hasPaid = s.payment?.status === "paid" || s.payment?.status === "confirmed";
                const isConfirmed = s.payment?.status === "confirmed";

                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #1a1a1a",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 14 }}>{s.name}</span>
                      {s.payment?.utrNumber && (
                        <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>
                          UTR: {s.payment.utrNumber}
                        </span>
                      )}
                      {s.payment?.paymentMethod === "cash" && (
                        <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 8 }}>💵 cash</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {!hasPaid && (
                        <span style={{ fontSize: 12, color: "#f87171" }}>✗ Pending</span>
                      )}
                      {hasPaid && !isConfirmed && (
                        <>
                          <span style={{ fontSize: 12, color: "#f59e0b" }}>⏳ Paid</span>
                          <button
                            onClick={async () => {
                              await fetch(`/api/vendor/payments/${s.payment.id}/confirm`, { method: "POST" });
                              load();
                            }}
                            style={{ fontSize: 11, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                          >
                            Confirm receipt
                          </button>
                        </>
                      )}
                      {isConfirmed && (
                        <span style={{ fontSize: 12, color: "#86efac" }}>✓ Confirmed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collection link */}
            <div style={{ background: "#0f172a", borderRadius: 6, padding: 10, border: "1px solid #1e3a5f" }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "#7dd3fc" }}>
                📎 Collection link — share this with subscribers
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={collectionUrl}
                  readOnly
                  style={{ flex: 1, fontSize: 12, fontFamily: "monospace", background: "#0a1628", border: "none", color: "#e0f2fe", borderRadius: 4, padding: "4px 8px" }}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(collectionUrl)}
                  style={{ fontSize: 12, background: "#1e40af", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}