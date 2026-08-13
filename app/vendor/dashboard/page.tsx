"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import VendorCollectionsGrid from "@/components/VendorCollectionsGrid";
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

  function goToEdit(collectionId: string) {
    setNavLabel("Loading collection");
    router.push(`/vendor/collection/${collectionId}/edit`);
  }

  async function handleDelete(row: { id: string; title: string; hasAnyPaid: boolean }) {
    if (row.hasAnyPaid) return;

    const ok = await confirm({
      title: "Delete collection?",
      message: `Delete "${row.title}"? This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/vendor/collections/${row.id}`, { method: "DELETE" });
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

  function handleCopyLink(url: string) {
    navigator.clipboard.writeText(url);
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
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
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

      {/* Collections table */}
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
        Collections
      </h2>

      {vendor.collections.length === 0 ? (
        <div style={{ padding: 24, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#888", margin: 0 }}>No collections yet.</p>
          <button
            onClick={goToNewCollection}
            style={{ marginTop: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
          >
            Create your first collection
          </button>
        </div>
      ) : (
        <VendorCollectionsGrid
          collections={vendor.collections}
          onEdit={goToEdit}
          onDelete={handleDelete}
          onCopyLink={handleCopyLink}
        />
      )}
    </div>
  );
}