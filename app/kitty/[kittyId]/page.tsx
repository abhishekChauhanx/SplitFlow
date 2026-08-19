"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function KittyDetailPage() {
  const { kittyId } = useParams();
  const router = useRouter();
  const [kitty, setKitty] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  // Expense logging
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [addingExpense, setAddingExpense] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/kitty/${kittyId}`);
    if (!res.ok) return;
    const data = await res.json();
    setKitty(data);
    setEditTitle(data.title);
    setEditDescription(data.description || "");
    setEditTarget((data.targetPaise / 100).toString());
    setEditDeadline(data.deadline ? data.deadline.slice(0, 10) : "");
  }, [kittyId]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => setCurrentUserId(me.userId));
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;
  if (!kitty) return <p style={{ textAlign: "center", marginTop: 80, color: "#f87171" }}>Kitty not found.</p>;

  const isOrganizer = kitty.organizerId === currentUserId;
  const myContribution = kitty.contributions.find((c: any) => c.userId === currentUserId);
  const pct = kitty.targetPaise > 0 ? Math.min(100, (kitty.totalCollected / kitty.targetPaise) * 100) : 0;

  async function generateInvite() {
    const link = `${window.location.origin}/kitty/join/${kitty.token}`;
    setInviteLink(link);
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
      if (!res.ok) {
        const d = await res.json();
        alert(d.error);
        return;
      }
      setEditing(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteKitty() {
    if (!confirm(`Delete "${kitty.title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/kitty/${kittyId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        setDeleting(false);
        return;
      }
      router.push("/kitty");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmContribution(contributionId: string) {
    await fetch(`/api/kitty/${kittyId}/confirm-contribution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contributionId }),
    });
    await load();
  }

  async function addExpense() {
    if (!expenseDesc || !expenseAmount) return;
    setAddingExpense(true);
    try {
      await fetch(`/api/kitty/${kittyId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseDesc,
          amountPaise: Math.round(parseFloat(expenseAmount) * 100),
        }),
      });
      setExpenseDesc("");
      setExpenseAmount("");
      await load();
    } finally {
      setAddingExpense(false);
    }
  }

  async function closeKitty() {
    if (!confirm(`Close "${kitty.title}" and calculate refunds? This can't be undone.`)) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/kitty/${kittyId}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        setClosing(false);
        return;
      }
      await load();
    } finally {
      setClosing(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <BackButton href="/kitty" />
        <h1 style={{ margin: 0, fontSize: 20 }}>{kitty.title}</h1>
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
          <button onClick={generateInvite} style={{ fontSize: 13 }}>🔗 Invite link</button>
          <button onClick={() => setEditing(!editing)} style={{ fontSize: 13 }}>✎ Edit</button>
          <button onClick={deleteKitty} disabled={deleting} style={{ fontSize: 13, color: "#f87171" }}>
            {deleting ? "Deleting..." : "🗑 Delete"}
          </button>
          <button onClick={closeKitty} disabled={closing} style={{ fontSize: 13, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
            {closing ? "Closing..." : "✓ Close & refund"}
          </button>
        </div>
      )}

      {inviteLink && (
        <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#7dd3fc" }}>📎 Share this invite link</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={inviteLink} readOnly style={{ flex: 1, fontSize: 12, fontFamily: "monospace" }} />
            <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ fontSize: 12 }}>Copy</button>
            <button onClick={() => setInviteLink(null)} style={{ fontSize: 12 }}>✕</button>
          </div>
          <p style={{ fontSize: 11, color: "#888", margin: "6px 0 0" }}>
            Anyone with this link can log in and join as a contributor.
          </p>
        </div>
      )}

      {editing && (
        <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Edit kitty</h3>
          <input placeholder="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <input placeholder="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <input type="number" placeholder="Target (₹)" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
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
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
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
                  <button onClick={() => confirmContribution(c.id)} style={{ fontSize: 11, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>
                    Confirm
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
      <h2 style={{ fontSize: 15, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>
        Spent from this pool
      </h2>
      {kitty.expenses.length === 0 && <p style={{ color: "#888", fontSize: 13 }}>Nothing spent yet.</p>}
      {kitty.expenses.map((e: any) => (
        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a", fontSize: 13 }}>
          <span>{e.description}</span>
          <span>₹{(e.amountPaise / 100).toFixed(0)}</span>
        </div>
      ))}

      {isOrganizer && kitty.status === "collecting" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input placeholder="What was it spent on?" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} style={{ flex: 2 }} />
          <input type="number" placeholder="₹" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ flex: 1 }} />
          <button onClick={addExpense} disabled={addingExpense || !expenseDesc || !expenseAmount}>
            {addingExpense ? "Adding..." : "+ Log"}
          </button>
        </div>
      )}
    </div>
  );
}