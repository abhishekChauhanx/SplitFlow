"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";

export default function GroupDetailPage() {
  const { id } = useParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [placeholderName, setPlaceholderName] = useState("");
  const [placeholderPhone, setPlaceholderPhone] = useState("");
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaidById, setEditPaidById] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState("EQUAL");
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});

  // Permission system state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]); // for owner
  const [myPermissions, setMyPermissions] = useState<Record<string, string>>({}); // expenseId -> status
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, string>>({}); // expenseId -> permissionId

  // FIX: use a ref, not state, to track which permission IDs we've already alerted about.
  // A ref's value is always current inside closures — it doesn't go stale the way
  // state captured by a setInterval created once in useEffect does. That staleness
  // was why the "approved" alert kept firing every poll instead of just once.
  const notifiedPermissionsRef = useRef<Set<string>>(new Set());

  const loadGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}`);
    const group = await res.json();
    if (!group || !group.members) return;
    setMembers(group.members);
    if (group.members.length > 0) setPaidById(group.members[0].userId);
  }, [id]);

  const loadExpenses = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/expenses`);
    setExpenses(await res.json());
  }, [id]);

  // Poll for pending requests (owner side — someone wants to edit MY expense)
  const loadPendingRequests = useCallback(() => {
    fetch("/api/edit-permissions/pending")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPendingRequests(data);
      });
  }, []);

  // Poll for my own request statuses (requester side — did owner approve/deny?)
  const loadMyPermissions = useCallback(() => {
    fetch("/api/edit-permissions/my-requests")
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;

        const map: Record<string, string> = {};
        const idMap: Record<string, string> = {};

        data.forEach((p) => {
          // FIX: if the expense this permission points to was deleted, the include
          // comes back null. Skip it entirely instead of trying to read
          // p.expense.description on a null value.
          if (!p.expense) return;

          map[p.expenseId] = p.status;
          idMap[p.expenseId] = p.id;

          // Show alert ONCE when status changes to approved or denied
          if (
            (p.status === "approved" || p.status === "denied") &&
            !notifiedPermissionsRef.current.has(p.id)
          ) {
            notifiedPermissionsRef.current.add(p.id);
            if (p.status === "approved") {
              alert(
                `✅ Permission approved!\n\nYou can now edit or delete "${p.expense.description}".\n\nClick OK to see the Edit and Delete buttons.`
              );
            } else {
              alert(
                `❌ Permission denied.\n\nThe expense creator declined your request to edit "${p.expense.description}".`
              );
            }
          }
        });

        setMyPermissions(map);
        setPendingRequestIds(idMap);
      });
  }, []); // FIX: no longer depends on notifiedPermissions state, so this function reference is stable

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => setCurrentUserId(me.userId));
    loadExpenses();
    loadGroup();
    loadPendingRequests();
    loadMyPermissions();

    // Poll every 8 seconds for real-time updates, but only while the tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPendingRequests();
        loadMyPermissions();
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [id, loadExpenses, loadGroup, loadPendingRequests, loadMyPermissions]);

  // Manual refresh: reloads everything this page depends on at once
  const refreshAll = useCallback(async () => {
    await Promise.all([loadExpenses(), loadGroup(), loadPendingRequests(), loadMyPermissions()]);
  }, [loadExpenses, loadGroup, loadPendingRequests, loadMyPermissions]);

  // Owner responds to a request
  async function respondToRequest(permissionId: string, decision: "approved" | "denied") {
    await fetch(`/api/edit-permissions/${permissionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadPendingRequests();
  }

  // Requester asks for permission
  async function requestEditPermission(expenseId: string, action: string) {
    const res = await fetch(`/api/groups/${id}/expenses/${expenseId}/request-edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();

    if (data.approved) {
      // Already approved (owner or previously approved) — show edit inline
      setEditingExpense(expenseId);
      const expense = expenses.find((e) => e.id === expenseId);
      if (expense) {
        setEditDesc(expense.description);
        setEditAmount((expense.amountPaise / 100).toString());
        setEditPaidById(expense.paidById);
      }
    } else {
      alert(
        `📩 Permission request sent!\n\nThe creator of this expense has been notified. You'll see an alert here once they approve or deny your request.\n\nThe page checks for updates every 8 seconds automatically.`
      );
      // Update local state so button shows "Request sent"
      setMyPermissions((prev) => ({ ...prev, [expenseId]: "pending" }));
    }
  }

  async function deleteExpense(expenseId: string) {
    if (!confirm("Delete this expense? Balances will recalculate.")) return;
    const res = await fetch(`/api/groups/${id}/expenses/${expenseId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      if (data.error === "permission_required") {
        requestEditPermission(expenseId, "delete");
        return;
      }
      alert(data.error);
      return;
    }
    setExpenses(expenses.filter((e) => e.id !== expenseId));
    // Clear permission after use
    setMyPermissions((prev) => { const n = { ...prev }; delete n[expenseId]; return n; });
  }

  async function saveEditExpense(expenseId: string) {
    const res = await fetch(`/api/groups/${id}/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editDesc,
        amountPaise: Math.round(parseFloat(editAmount) * 100),
        paidById: editPaidById,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      if (d.error === "permission_required") {
        alert("You need permission from the expense creator to edit this.");
        return;
      }
      alert(d.error);
      return;
    }
    const updated = await res.json();
    setExpenses(expenses.map((e) => (e.id === expenseId ? updated : e)));
    setEditingExpense(null);
    // Clear permission after use
    setMyPermissions((prev) => { const n = { ...prev }; delete n[expenseId]; return n; });
  }

  async function generateInvite() {
    const res = await fetch(`/api/groups/${id}/invite`, { method: "POST" });
    const data = await res.json();
    setInviteLink(data.link);
  }

  async function addPlaceholder() {
    await fetch(`/api/groups/${id}/placeholder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: placeholderName, phone: placeholderPhone }),
    });
    setPlaceholderName("");
    setPlaceholderPhone("");
    setShowPlaceholder(false);
    loadGroup();
  }

  async function addExpense(confirmDuplicate = false) {
    setError(null);
    const amountPaise = Math.round(parseFloat(amount) * 100);

    const exactAmounts = expenseSplitType === "EXACT"
      ? Object.fromEntries(Object.entries(exactInputs).map(([uid, v]) => [uid, Math.round(parseFloat(v) * 100)]))
      : undefined;

    const percentages = expenseSplitType === "PERCENTAGE"
      ? Object.fromEntries(Object.entries(percentInputs).map(([uid, v]) => [uid, parseFloat(v)]))
      : undefined;

    const shareUnits = expenseSplitType === "SHARES"
      ? Object.fromEntries(
          Object.entries(shareInputs)
            .filter(([, v]) => v)
            .map(([uid, v]) => [uid, parseInt(v)])
        )
      : undefined;

    const res = await fetch(`/api/groups/${id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amountPaise, paidById, splitType: expenseSplitType, exactAmounts, percentages, shareUnits, confirmDuplicate }),
    });

    if (res.status === 409) {
      const data = await res.json();
      setWarning(data.message);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add expense");
      return;
    }

    const expense = await res.json();
    setExpenses([expense, ...expenses]);
    setDescription("");
    setAmount("");
    setWarning(null);
  }

  async function addMember() {
    setMemberError(null);
    const res = await fetch(`/api/groups/${id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMemberError(data.error || "Couldn't add member");
      return;
    }
    setMemberEmail("");
    loadGroup();
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Group</h1>
        <RefreshButton onRefresh={refreshAll} />
      </div>

      <Link href={`/groups/${id}/balances`}>View balances</Link>
      {" | "}
      <Link href={`/groups/${id}/settle`}>Settle up</Link>
      {" | "}
      <Link href={`/groups/${id}/recurring`}>Recurring expenses</Link>

      {/* ── Owner: pending permission requests ── */}
      {pendingRequests.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: "#1a1a0a", border: "1px solid #f59e0b", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 8px", color: "#f59e0b" }}>
            📋 Edit permission requests ({pendingRequests.length})
          </h3>
          {pendingRequests.map((req) => (
            <div key={req.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #333" }}>
              <p style={{ margin: "0 0 6px" }}>
                <strong>{req.requestedBy.name || req.requestedBy.email}</strong> wants to{" "}
                <strong>{req.action}</strong> expense:{" "}
                <em>"{req.expense.description}" — ₹{(req.expense.amountPaise / 100).toFixed(2)}</em>
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => respondToRequest(req.id, "approved")}
                  style={{ background: "#16a34a", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer" }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => respondToRequest(req.id, "denied")}
                  style={{ background: "#dc2626", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer" }}
                >
                  ✗ Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Members</h2>
      <ul>
        {members.map((m) => (
          <li key={m.userId}>
            {m.user.name || m.user.email}
            {m.userId === currentUserId && (
              <span style={{ color: "#888", fontSize: 12, marginLeft: 6 }}>(me)</span>
            )}
          </li>
        ))}
      </ul>
      <input placeholder="Member's email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
      <button onClick={addMember} disabled={!memberEmail}>Add member</button>
      {memberError && <p style={{ color: "red" }}>{memberError}</p>}

      <button onClick={generateInvite}>Generate invite link</button>
      {inviteLink && (
        <div style={{ marginTop: 8 }}>
          <input value={inviteLink} readOnly style={{ width: "100%" }} />
          <button onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</button>
          <p style={{ fontSize: 12, color: "#888" }}>Valid 7 days — share via WhatsApp or copy.</p>
        </div>
      )}

      <button onClick={() => setShowPlaceholder(!showPlaceholder)}>Add placeholder member</button>
      {showPlaceholder && (
        <div>
          <input placeholder="Name (required)" value={placeholderName} onChange={(e) => setPlaceholderName(e.target.value)} />
          <input placeholder="Phone (optional)" value={placeholderPhone} onChange={(e) => setPlaceholderPhone(e.target.value)} />
          <button onClick={addPlaceholder} disabled={!placeholderName}>Add placeholder</button>
          <p style={{ fontSize: 12, color: "#888" }}>No app required — included in splits but can't log in.</p>
        </div>
      )}

      <h2>Add expense</h2>
      <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input placeholder="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <select value={paidById} onChange={(e) => setPaidById(e.target.value)}>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.user.name || m.user.email}{m.userId === currentUserId ? " (me)" : ""}
          </option>
        ))}
      </select>

      <select value={expenseSplitType} onChange={(e) => setExpenseSplitType(e.target.value)}>
        <option value="EQUAL">Split equally</option>
        <option value="EXACT">Exact amounts</option>
        <option value="PERCENTAGE">By percentage</option>
        <option value="SHARES">By shares</option>
      </select>

      {expenseSplitType === "EXACT" && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>Enter how much each person owes exactly:</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: ₹</label>
              <input type="number" placeholder="0" value={exactInputs[m.userId] || ""} onChange={(e) => setExactInputs({ ...exactInputs, [m.userId]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {expenseSplitType === "PERCENTAGE" && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>Enter % each person owes (must total 100%):</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: </label>
              <input type="number" placeholder="0" value={percentInputs[m.userId] || ""} onChange={(e) => setPercentInputs({ ...percentInputs, [m.userId]: e.target.value })} />
              <span>%</span>
            </div>
          ))}
        </div>
      )}

      {expenseSplitType === "SHARES" && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>Enter share units (e.g. meals eaten):</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: </label>
              <input type="number" placeholder="0" value={shareInputs[m.userId] || ""} onChange={(e) => setShareInputs({ ...shareInputs, [m.userId]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      <button onClick={() => addExpense(false)}>Add</button>
      {warning && (
        <div style={{ color: "orange" }}>
          {warning} <button onClick={() => addExpense(true)}>Add anyway</button>
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Expenses</h2>
      <ul>
        {expenses.map((e) => {
          const isOwner = e.paidById === currentUserId;
          const permStatus = myPermissions[e.id]; // undefined | "pending" | "approved" | "denied"
          const hasApproval = permStatus === "approved";

          return (
            <li key={e.id} style={{ marginBottom: 12 }}>
              {editingExpense === e.id ? (
                // ── Edit form ──
                <div>
                  <input value={editDesc} onChange={(ev) => setEditDesc(ev.target.value)} />
                  <input type="number" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)} />
                  <select value={editPaidById} onChange={(ev) => setEditPaidById(ev.target.value)}>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.user.name || m.user.email}</option>
                    ))}
                  </select>
                  <button onClick={() => saveEditExpense(e.id)}>Save</button>
                  <button onClick={() => setEditingExpense(null)}>Cancel</button>
                </div>
              ) : (
                // ── Display row ──
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{e.description} — ₹{(e.amountPaise / 100).toFixed(2)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(isOwner || hasApproval) ? (
                      // Owner or approved — show Edit and Delete
                      <>
                        <button onClick={() => {
                          setEditingExpense(e.id);
                          setEditDesc(e.description);
                          setEditAmount((e.amountPaise / 100).toString());
                          setEditPaidById(e.paidById);
                        }}>Edit</button>
                        <button onClick={() => deleteExpense(e.id)}>Delete</button>
                      </>
                    ) : permStatus === "pending" ? (
                      // Waiting for owner's response
                      <span style={{ fontSize: 12, color: "#f59e0b" }}>
                        ⏳ Waiting for approval...
                      </span>
                    ) : permStatus === "denied" ? (
                      // Owner denied — show greyed out message
                      <span style={{ fontSize: 12, color: "#888" }}>
                        ✗ Permission denied
                      </span>
                    ) : (
                      // No request yet — show request button
                      <button
                        onClick={() => requestEditPermission(e.id, "edit")}
                        style={{ fontSize: 12 }}
                      >
                        🔒 Request edit access
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}