"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import Spinner from "@/components/Spinner";
import VendorCollectionsGrid from "@/components/VendorCollectionsGrid";
import NotificationBell from "@/components/NotificationBell";
import { useModal } from "@/components/ModalProvider";

type PendingConfirmation = {
  paymentId: string;
  subscriberName: string;
  collectionTitle: string;
  amountPaise: number;
};

function Dialog({
  icon,
  iconColor,
  title,
  onBackdropClick,
  children,
  footer,
  width = 440,
}: {
  icon: string;
  iconColor: string;
  title: string;
  onBackdropClick: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onBackdropClick}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 90vw)`, maxHeight: "85vh", display: "flex", flexDirection: "column",
          borderRadius: 10, overflow: "hidden", border: "1px solid #333",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)", background: "#161616",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)", borderBottom: "1px solid #2a2a2a", flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: iconColor, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0,
          }}>{icon}</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#eee" }}>{title}</span>
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {children}
        </div>

        {footer && (
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px",
            background: "#141414", borderTop: "1px solid #2a2a2a", flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function DialogButton({
  onClick, disabled, variant = "primary", children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 16px", borderRadius: 6, border: isPrimary ? "none" : "1px solid #444",
        background: isPrimary ? "#2563eb" : "transparent", color: isPrimary ? "#fff" : "#ccc",
        fontWeight: isPrimary ? 600 : 400, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1, fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

export default function VendorDashboardPage() {
  const router = useRouter();
  const { confirm } = useModal();
  const [vendor, setVendor] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [navLabel, setNavLabel] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [viewingCollectionId, setViewingCollectionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/vendor/register", { cache: "no-store" });
    const data = await res.json();
    if (!data || data.error) {
      router.push("/vendor/register");
      return;
    }
    setVendor(data);
  }, [router]);

  const silentReload = useCallback(async () => {
    try {
      const res = await fetch("/api/vendor/register", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || data.error) return;
      setVendor(data);
    } catch {
      // ignore — will retry on next poll tick
    }
  }, []);

  useEffect(() => {
    load().finally(() => setInitialLoading(false));

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        silentReload();
      }
    }, 8000);

    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        silentReload();
      }
    }
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [load, silentReload]);

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
        setDeletingId(null);
        await confirm({ title: "Can't delete", message: data.error || "Failed to delete this collection.", mode: "alert" });
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleConfirmPayment(paymentId: string) {
    setConfirmingPaymentId(paymentId);
    try {
      await fetch(`/api/vendor/payments/${paymentId}/confirm`, { method: "POST" });
      await load();
    } finally {
      setConfirmingPaymentId(null);
    }
  }

  function handleCopyLink(url: string) {
    navigator.clipboard.writeText(url);
  }

  const pendingConfirmations = useMemo<PendingConfirmation[]>(() => {
    if (!vendor) return [];
    const list: PendingConfirmation[] = [];
    for (const c of vendor.collections) {
      for (const s of c.subscribers) {
        if (s.payment?.status === "paid") {
          list.push({
            paymentId: s.payment.id,
            subscriberName: s.name,
            collectionTitle: c.title,
            amountPaise: s.payment.amountPaise,
          });
        }
      }
    }
    return list;
  }, [vendor]);

  const overlayVisible = initialLoading || !!navLabel || !!deletingId;
  const overlayLabel = deletingId ? "Deleting collection" : navLabel || "Loading vendor dashboard";

  if (!vendor) {
    return <SFLoaderOverlay visible={overlayVisible} label={overlayLabel} />;
  }

  const totalExpected = vendor.collections.reduce((sum: number, c: any) => sum + c.subscribers.length * c.amountPaise, 0);
  const totalConfirmed = vendor.collections.reduce((sum: number, c: any) => {
    const confirmed = c.subscribers.filter((s: any) => s.payment?.status === "confirmed").length;
    return sum + confirmed * c.amountPaise;
  }, 0);
  const totalAwaitingConfirmation = pendingConfirmations.reduce((sum, p) => sum + p.amountPaise, 0);
  const totalPending = totalExpected - totalConfirmed - totalAwaitingConfirmation;

  const viewingCollection = viewingCollectionId
    ? vendor.collections.find((c: any) => c.id === viewingCollectionId)
    : null;

  return (
    <div style={{ maxWidth: 1400, margin: "40px auto", padding: "0 24px" }}>
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
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <RefreshButton onRefresh={load} label="Refreshing vendor dashboard" />
          <NotificationBell<PendingConfirmation>
            items={pendingConfirmations}
            getKey={(p) => p.paymentId}
            emptyMessage="Nothing needs your attention."
            renderItem={(p) => (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, color: "#eee" }}>
                    {p.subscriberName} paid ₹{(p.amountPaise / 100).toFixed(0)}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>{p.collectionTitle}</p>
                </div>
                <button
                  onClick={() => handleConfirmPayment(p.paymentId)}
                  disabled={confirmingPaymentId === p.paymentId}
                  style={{
                    fontSize: 11, background: "#14532d", color: "#86efac", border: "none",
                    borderRadius: 4, padding: "4px 10px", cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  {confirmingPaymentId === p.paymentId ? <Spinner /> : "Confirm"}
                </button>
              </div>
            )}
          />
          <button
            onClick={goToNewCollection}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
          >
            + New collection
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total expected", value: `₹${(totalExpected / 100).toFixed(0)}`, color: "#fff" },
          { label: "Confirmed", value: `₹${(totalConfirmed / 100).toFixed(0)}`, color: "#86efac" },
          { label: "Awaiting confirmation", value: `₹${(totalAwaitingConfirmation / 100).toFixed(0)}`, color: "#f59e0b" },
          { label: "Pending", value: `₹${(totalPending / 100).toFixed(0)}`, color: "#f87171" },
        ].map((card) => (
          <div key={card.label} style={{ padding: 14, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888" }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</p>
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
          onView={setViewingCollectionId}
          onCopyLink={handleCopyLink}
        />
      )}

      {/* Subscribers dialog */}
      {viewingCollection && (
        <Dialog
          icon="👥"
          iconColor="#2563eb"
          title={viewingCollection.title}
          onBackdropClick={() => setViewingCollectionId(null)}
          footer={<DialogButton onClick={() => setViewingCollectionId(null)}>Close</DialogButton>}
        >
          {viewingCollection.subscribers.length === 0 && (
            <p style={{ color: "#888", fontSize: 13, margin: 0 }}>No subscribers in this collection.</p>
          )}
          {viewingCollection.subscribers.map((s: any) => {
            const hasPaid = s.payment?.status === "paid" || s.payment?.status === "confirmed";
            const isConfirmed = s.payment?.status === "confirmed";
            return (
              <div
                key={s.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: "1px solid #1a1a1a",
                }}
              >
                <div>
                  <span style={{ fontSize: 14 }}>{s.name}</span>
                  {s.payment?.utrNumber && (
                    <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>UTR: {s.payment.utrNumber}</span>
                  )}
                  {s.payment?.paymentMethod === "cash" && (
                    <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 8 }}>💵 cash</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!hasPaid && <span style={{ fontSize: 12, color: "#f87171" }}>✗ Pending</span>}
                  {hasPaid && !isConfirmed && (
                    <>
                      <span style={{ fontSize: 12, color: "#f59e0b" }}>⏳ Paid — awaiting confirmation</span>
                      <button
                        onClick={() => handleConfirmPayment(s.payment.id)}
                        disabled={confirmingPaymentId === s.payment.id}
                        style={{ fontSize: 11, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        {confirmingPaymentId === s.payment.id ? <Spinner /> : "Confirm receipt"}
                      </button>
                    </>
                  )}
                  {isConfirmed && <span style={{ fontSize: 12, color: "#86efac" }}>✓ Confirmed</span>}
                </div>
              </div>
            );
          })}
        </Dialog>
      )}
    </div>
  );
}