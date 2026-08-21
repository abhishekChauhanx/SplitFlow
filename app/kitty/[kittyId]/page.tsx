"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import Spinner from "@/components/Spinner";
import { useModal } from "@/components/ModalProvider";

// Same dialog chrome pattern used on the group page — kept local since it's
// not exported as a shared component there either.
function Dialog({
  icon, iconColor, title, onBackdropClick, children, footer, width = 400,
}: {
  icon: string; iconColor: string; title: string; onBackdropClick: () => void;
  children: React.ReactNode; footer: React.ReactNode; width?: number;
}) {
  return (
    <div
      onClick={onBackdropClick}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 90vw)`, maxHeight: "85vh", display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", border: "1px solid #333", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", background: "#161616" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)", borderBottom: "1px solid #2a2a2a", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: iconColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{icon}</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#eee" }}>{title}</span>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px", background: "#141414", borderTop: "1px solid #2a2a2a", flexShrink: 0 }}>{footer}</div>
      </div>
    </div>
  );
}

function DialogButton({
  onClick, disabled, variant = "primary", children,
}: { onClick: () => void; disabled?: boolean; variant?: "primary" | "secondary"; children: React.ReactNode }) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ padding: "6px 16px", borderRadius: 6, border: isPrimary ? "none" : "1px solid #444", background: isPrimary ? "#2563eb" : "transparent", color: isPrimary ? "#fff" : "#ccc", fontWeight: isPrimary ? 600 : 400, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, fontSize: 13 }}
    >
      {children}
    </button>
  );
}

export default function KittyDetailPage() {
  const { kittyId } = useParams();
  const router = useRouter();
  const { confirm } = useModal();
  const [kitty, setKitty] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Dialog visibility
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  // Expense state
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [addingExpense, setAddingExpense] = useState(false);

  const [inviteLink, setInviteLink] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/kitty/${kittyId}`);
    if (!res.ok) return;
    const data = await res.json();
    setKitty(data);
  }, [kittyId]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => setCurrentUserId(me.userId));
    load().finally(() => setInitialLoading(false));
  }, [load]);

  const actionLoading = saving || addingExpense || deleting || closing || confirmingId !== null;
  const loaderLabel = saving ? "Saving changes" : addingExpense ? "Logging expense" : deleting ? "Deleting" : closing ? "Closing and calculating refunds" : confirmingId ? "Confirming" : "";

  if (initialLoading) return <SFLoaderOverlay visible={true} label="Loading collection pool" />;
  if (!kitty) return <p style={{ textAlign: "center", marginTop: 80, color: "#f87171" }}>Kitty not found.</p>;

  const isOrganizer = kitty.organizerId === currentUserId;
  const myContribution = kitty.contributions.find((c: any) => c.userId === currentUserId);
  const pct = kitty.targetPaise > 0 ? Math.min(100, (kitty.totalCollected / kitty.targetPaise) * 100) : 0;

  function openEditModal() {
    setEditTitle(kitty.title);
    setEditDescription(kitty.description || "");
    setEditTarget((kitty.targetPaise / 100).toString());
    setEditDeadline(kitty.deadline ? kitty.deadline.slice(0, 10) : "");
    setShowEditModal(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/kitty/${kittyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          targetPaise: Math.round(parseFloat(editTarget) * 100),
          deadline: editDeadline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await confirm({ title: "Couldn't save", message: data.error, mode: "alert" });
        return;
      }
      setShowEditModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function openInviteModal() {
    setInviteLink(`${window.location.origin}/kitty/join/${kitty.token}`);
    setShowInviteModal(true);
  }

  async function deleteKitty() {
    const ok = await confirm({
      title: "Delete collection pool?",
      message: `Delete "${kitty.title}"? This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/kitty/${kittyId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        await confirm({ title: "Can't delete", message: data.error, mode: "alert" });
        return;
      }
      router.push("/kitty");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmContribution(contributionId: string) {
    setConfirmingId(contributionId);
    try {
      await fetch(`/api/kitty/${kittyId}/confirm-contribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionId }),
      });
      await load();
    } finally {
      setConfirmingId(null);
    }
  }

  async function addExpense() {
    if (!expenseDesc.trim() || !expenseAmount) return;
    setAddingExpense(true);
    try {
      const res = await fetch(`/api/kitty/${kittyId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: expenseDesc.trim(), amountPaise: Math.round(parseFloat(expenseAmount) * 100) }),
      });
      const data = await res.json();
      if (!res.ok) {
        await confirm({ title: "Couldn't log expense", message: data.error, mode: "alert" });
        return;
      }
      setExpenseDesc("");
      setExpenseAmount("");
      setShowExpenseModal(false);
      await load();
    } finally {
      setAddingExpense(false);
    }
  }

  async function closeKitty() {
    const ok = await confirm({
      title: "Close and calculate refunds?",
      message: `Close "${kitty.title}"? Remaining funds will be split proportionally among contributors. This can't be undone.`,
      confirmLabel: "Close & refund",
    });
    if (!ok) return;

    setClosing(true);
    try {
      const res = await fetch(`/api/kitty/${kittyId}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        await confirm({ title: "Couldn't close", message: data.error, mode: "alert" });
        return;
      }
      await load();
    } finally {
      setClosing(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={actionLoading} label={loaderLabel} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <BackButton href="/kitty" />
        <h1 style={{ margin: 0, fontSize: 20 }}>{kitty.title}</h1>
        <RefreshButton onRefresh={load} label="Refreshing collection pool" />
        <span style={{
          fontSize: 11, padding: "3px 8px", borderRadius: 4,
          background: kitty.status === "collecting" ? "#172554" : kitty.status === "closed" ? "#1c1917" : "#14532d",
          color: kitty.status === "collecting" ? "#60a5fa" : kitty.status === "closed" ? "#a8a29e" : "#86efac",
        }}>
          {kitty.status === "collecting" ? "🟡 Collecting" : kitty.status === "closed" ? "⚪ Closed" : "✓ Refunded"}
        </span>
      </div>

      {kitty.description && <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>{kitty.description}</p>}

      {/* Progress */}
      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "#888" }}>
            ₹{(kitty.totalCollected / 100).toFixed(0)} of ₹{(kitty.targetPaise / 100).toFixed(0)} collected
          </span>
          <span style={{ fontSize: 13, color: "#888" }}>{Math.round(pct)}%</span>
        </div>
        <div style={{ background: "#2a2a2a", borderRadius: 4, height: 8 }}>
          <div style={{ background: "#60a5fa", borderRadius: 4, height: 8, width: `${pct}%` }} />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 13, color: "#888" }}>
          <span>Spent: ₹{(kitty.totalSpent / 100).toFixed(0)}</span>
          <span>Remaining: ₹{(kitty.remaining / 100).toFixed(0)}</span>
        </div>
        {kitty.deadline && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f59e0b" }}>
            Deadline: {new Date(kitty.deadline).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Organizer actions */}
      {isOrganizer && kitty.status === "collecting" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={openInviteModal} style={{ fontSize: 13 }}>🔗 Invite link</button>
          <button onClick={openEditModal} style={{ fontSize: 13 }}>✎ Edit</button>
          <button onClick={deleteKitty} disabled={deleting} style={{ fontSize: 13, color: "#f87171" }}>
            {deleting ? <Spinner /> : "🗑 Delete"}
          </button>
          <button onClick={closeKitty} disabled={closing} style={{ fontSize: 13, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
            {closing ? <Spinner /> : "✓ Close & refund"}
          </button>
        </div>
      )}

      {/* My contribution status (non-organizer view) */}
      {!isOrganizer && myContribution && kitty.status === "collecting" && (
        <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          {myContribution.status === "pending" ? (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>
                Your share: ₹{(myContribution.amountPaise / 100).toFixed(0)}
              </p>
              <Link href={`/kitty/join/${kitty.token}`}>
                <button style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}>
                  Pay now
                </button>
              </Link>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "#86efac" }}>
              ✓ You contributed ₹{((myContribution.paidAmountPaise || 0) / 100).toFixed(0)}
              {myContribution.status === "confirmed" ? " (confirmed)" : " (awaiting confirmation)"}
            </p>
          )}
        </div>
      )}

      {/* Contributors list */}
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Contributors ({kitty.contributions.length})
      </h2>
      {kitty.contributions.map((c: any) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a1a", flexWrap: "wrap", gap: 6 }}>
          <div>
            <span style={{ fontSize: 14 }}>{c.user.name || c.user.email}</span>
            {c.utrNumber && <span style={{ fontSize: 11, color: "#555", marginLeft: 8 }}>UTR: {c.utrNumber}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {c.status === "pending" && <span style={{ fontSize: 12, color: "#f87171" }}>Not paid</span>}
            {c.status === "paid" && (
              <>
                <span style={{ fontSize: 12, color: "#f59e0b" }}>⏳ Paid — awaiting confirmation</span>
                {isOrganizer && (
                  <button
                    onClick={() => confirmContribution(c.id)}
                    disabled={confirmingId === c.id}
                    style={{ fontSize: 11, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                  >
                    {confirmingId === c.id ? <Spinner /> : "Confirm"}
                  </button>
                )}
              </>
            )}
            {c.status === "confirmed" && <span style={{ fontSize: 12, color: "#86efac" }}>✓ Confirmed</span>}
            {c.refundPaise != null && c.refundPaise > 0 && (
              <span style={{ fontSize: 12, color: "#a3e635" }}>Refund: ₹{(c.refundPaise / 100).toFixed(0)}</span>
            )}
          </div>
        </div>
      ))}

      {/* Expenses log */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
          Spent from this pool
        </h2>
        {isOrganizer && kitty.status === "collecting" && (
          <button onClick={() => setShowExpenseModal(true)} style={{ fontSize: 13 }}>+ Log spend</button>
        )}
      </div>
      {kitty.expenses.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Nothing spent yet.</p>}
      {kitty.expenses.map((e: any) => (
        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a", fontSize: 13 }}>
          <span>{e.description}</span>
          <span>₹{(e.amountPaise / 100).toFixed(0)}</span>
        </div>
      ))}

      {/* Edit dialog */}
      {showEditModal && (
        <Dialog
          icon="✎"
          iconColor="#2563eb"
          title="Edit collection pool"
          onBackdropClick={() => !saving && setShowEditModal(false)}
          footer={
            <>
              <DialogButton variant="secondary" onClick={() => setShowEditModal(false)} disabled={saving}>Cancel</DialogButton>
              <DialogButton onClick={saveEdit} disabled={saving}>{saving ? <Spinner /> : "Save"}</DialogButton>
            </>
          }
        >
          <input placeholder="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%" }} />
          <input placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: "100%" }} />
          <input type="number" placeholder="Target (₹)" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} style={{ width: "100%" }} />
          <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} style={{ width: "100%" }} />
        </Dialog>
      )}

      {/* Invite link dialog */}
      {showInviteModal && (
        <Dialog
          icon="🔗"
          iconColor="#16a34a"
          title="Invite link"
          onBackdropClick={() => setShowInviteModal(false)}
          footer={<DialogButton onClick={() => setShowInviteModal(false)}>OK</DialogButton>}
        >
          <input value={inviteLink} readOnly style={{ width: "100%" }} />
          <DialogButton variant="secondary" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</DialogButton>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            Anyone with this link needs to log in (or sign up) before they can contribute.
          </p>
        </Dialog>
      )}

      {/* Log expense dialog */}
      {showExpenseModal && (
        <Dialog
          icon="₹"
          iconColor="#2563eb"
          title="Log spend from this pool"
          onBackdropClick={() => !addingExpense && setShowExpenseModal(false)}
          footer={
            <>
              <DialogButton variant="secondary" onClick={() => setShowExpenseModal(false)} disabled={addingExpense}>Cancel</DialogButton>
              <DialogButton onClick={addExpense} disabled={!expenseDesc.trim() || !expenseAmount || addingExpense}>
                {addingExpense ? <Spinner /> : "Log"}
              </DialogButton>
            </>
          }
        >
          <input placeholder="What was it spent on?" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} style={{ width: "100%" }} autoFocus />
          <input type="number" placeholder="Amount (₹)" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ width: "100%" }} />
        </Dialog>
      )}
    </div>
  );
}