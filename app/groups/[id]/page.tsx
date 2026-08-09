"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import PageLoader from "@/components/PageLoader";
import { useModal } from "@/components/ModalProvider";
import GroupSummaryCards from "@/components/GroupSummaryCards";
import GroupExpensesGrid from "@/components/GroupExpensesGrid";
import type { GroupSummary } from "@/lib/group-summary";

export default function GroupDetailPage() {
  const { id } = useParams();
  const { confirm } = useModal();
  const [initialLoading, setInitialLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<GroupSummary | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
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

  // Loading states — one per listed action
  const [addingMember, setAddingMember] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [addingPlaceholder, setAddingPlaceholder] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [requestingPermissionId, setRequestingPermissionId] = useState<string | null>(null);

  // Permission system state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]); // for owner
  const [myPermissions, setMyPermissions] = useState<Record<string, string>>({}); // expenseId -> status
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, string>>({}); // expenseId -> permissionId

  // Same-tick safety net against double-firing within one poll. The real guard
  // against repeat notifications on remount/navigation is server-side (the
  // `notified` flag on EditPermission, and deleting denied rows once shown) —
  // see loadMyPermissions below.
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

  const loadSummary = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/summary`);
    if (res.ok) setSummary(await res.json());
  }, [id]);

  // Scoped to this group via groupId — without this, incoming requests from
  // every group the user owns expenses in would show up here regardless of
  // which group's page is actually open.
  const loadPendingRequests = useCallback(() => {
    return fetch(`/api/edit-permissions/pending?groupId=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPendingRequests(data);
      });
  }, [id]);

  // Scoped to this group via groupId, same reasoning as above. Notifications
  // are acknowledged server-side right after being shown, so they can't come
  // back on the next poll, on remount, or after navigating to another group.
  const loadMyPermissions = useCallback(() => {
    return fetch(`/api/edit-permissions/my-requests?groupId=${id}`)
      .then((r) => r.json())
      .then(async (data: any[]) => {
        if (!Array.isArray(data)) return;

        const map: Record<string, string> = {};
        const idMap: Record<string, string> = {};

        for (const p of data) {
          if (!p.expense) continue; // orphaned permission for a deleted expense

          map[p.expenseId] = p.status;
          idMap[p.expenseId] = p.id;

          const alreadyNotified = p.notified || notifiedPermissionsRef.current.has(p.id);

          if (p.status === "approved" && !alreadyNotified) {
            notifiedPermissionsRef.current.add(p.id);
            await confirm({
              title: "Permission approved",
              message: `You can now edit or delete "${p.expense.description}".`,
              mode: "alert",
            });
            fetch(`/api/edit-permissions/${p.id}/acknowledge`, { method: "POST" });
          } else if (p.status === "denied" && !alreadyNotified) {
            notifiedPermissionsRef.current.add(p.id);
            await confirm({
              title: "Permission denied",
              message: `The expense creator declined your request to edit "${p.expense.description}".`,
              mode: "alert",
            });
            fetch(`/api/edit-permissions/${p.id}/acknowledge`, { method: "POST" });
            // Denied rows get deleted server-side once acknowledged — drop it
            // from local state too so the button reverts to "Request edit access"
            delete map[p.expenseId];
            delete idMap[p.expenseId];
          }
        }

        setMyPermissions(map);
        setPendingRequestIds(idMap);
      });
  }, [confirm, id]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => setCurrentUserId(me.userId));
    Promise.all([loadExpenses(), loadGroup(), loadSummary(), loadPendingRequests(), loadMyPermissions()]).finally(() =>
      setInitialLoading(false)
    );

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPendingRequests();
        loadMyPermissions();
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [id, loadExpenses, loadGroup, loadSummary, loadPendingRequests, loadMyPermissions]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadExpenses(), loadGroup(), loadSummary(), loadPendingRequests(), loadMyPermissions()]);
  }, [loadExpenses, loadGroup, loadSummary, loadPendingRequests, loadMyPermissions]);

  async function respondToRequest(permissionId: string, decision: "approved" | "denied") {
    await fetch(`/api/edit-permissions/${permissionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadPendingRequests();
  }

  // e) Request edit access — replaces alert() with modal, adds per-expense loading
  async function requestEditPermission(expenseId: string, action: string) {
    setRequestingPermissionId(expenseId);
    try {
      const res = await fetch(`/api/groups/${id}/expenses/${expenseId}/request-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (data.approved) {
        setEditingExpense(expenseId);
        const expense = expenses.find((e) => e.id === expenseId);
        if (expense) {
          setEditDesc(expense.description);
          setEditAmount((expense.amountPaise / 100).toString());
          setEditPaidById(expense.paidById);
        }
      } else if (data.reason === "already_pending") {
        await confirm({
          title: "Already requested",
          message: "You've already requested this — waiting on the expense creator to respond.",
          mode: "alert",
        });
        setMyPermissions((prev) => ({ ...prev, [expenseId]: "pending" }));
      } else {
        await confirm({
          title: "Request sent",
          message: "The creator of this expense has been notified. You'll see an update here once they respond.",
          mode: "alert",
        });
        setMyPermissions((prev) => ({ ...prev, [expenseId]: "pending" }));
      }
    } finally {
      setRequestingPermissionId(null);
    }
  }

  // e) Delete expense — native confirm() replaced with modal, adds per-expense loading
  async function deleteExpense(expenseId: string) {
    const ok = await confirm({
      title: "Delete expense?",
      message: "This expense will be permanently deleted and balances will recalculate.",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeletingExpenseId(expenseId);
    try {
      const res = await fetch(`/api/groups/${id}/expenses/${expenseId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === "permission_required") {
          await requestEditPermission(expenseId, "delete");
          return;
        }
        await confirm({ title: "Couldn't delete", message: data.error, mode: "alert" });
        return;
      }
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      setMyPermissions((prev) => { const n = { ...prev }; delete n[expenseId]; return n; });
      loadSummary();
    } finally {
      setDeletingExpenseId(null);
    }
  }

  // e) Save edit — alert() replaced with modal, adds loading
  async function saveEditExpense(expenseId: string) {
    const ok = await confirm({
      title: "Save changes?",
      message: "Are you sure you want to save these changes to the expense?",
      confirmLabel: "Save",
    });
    if (!ok) return;

    setSavingEdit(true);
    try {
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
          await confirm({
            title: "Permission needed",
            message: "You need permission from the expense creator to edit this.",
            mode: "alert",
          });
          return;
        }
        await confirm({ title: "Couldn't save", message: d.error, mode: "alert" });
        return;
      }
      const updated = await res.json();
      setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
      setEditingExpense(null);
      setMyPermissions((prev) => { const n = { ...prev }; delete n[expenseId]; return n; });
      loadSummary();
    } finally {
      setSavingEdit(false);
    }
  }

  // b) Generate invite link — adds loading
  async function generateInvite() {
    const ok = await confirm({
      title: "Generate invite link?",
      message: "Are you sure you want to generate a new invite link? Anyone with the link can join this group.",
      confirmLabel: "Generate",
    });
    if (!ok) return;

    setGeneratingInvite(true);
    try {
      const res = await fetch(`/api/groups/${id}/invite`, { method: "POST" });
      const data = await res.json();
      setInviteLink(data.link);
    } finally {
      setGeneratingInvite(false);
    }
  }

  // c) Add placeholder member — adds loading
  async function addPlaceholder() {
    if (!placeholderName.trim()) return;
    const ok = await confirm({
      title: "Add placeholder member?",
      message: `Are you sure you want to add "${placeholderName}" as a placeholder member?`,
      confirmLabel: "Add",
    });
    if (!ok) return;

    setAddingPlaceholder(true);
    try {
      await fetch(`/api/groups/${id}/placeholder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: placeholderName, phone: placeholderPhone }),
      });
      setPlaceholderName("");
      setPlaceholderPhone("");
      setShowPlaceholder(false);
      await loadGroup();
      await loadSummary();
    } finally {
      setAddingPlaceholder(false);
    }
  }

  // d) & f) Add expense — duplicate/merge warnings now shown as modals, adds loading
  async function addExpense(confirmDuplicate = false, confirmMerge = false) {
    // Only ask "are you sure" on the initial attempt — recursive re-calls after
    // a duplicate/merge prompt are already a confirmed action.
    if (!confirmDuplicate && !confirmMerge) {
      if (!description.trim() || !amount) return;
      const ok = await confirm({
        title: "Add expense?",
        message: `Are you sure you want to add "${description.trim()}" for ₹${amount}?`,
        confirmLabel: "Add",
      });
      if (!ok) return;
    }

    setError(null);
    setAddingExpense(true);
    try {
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
        body: JSON.stringify({ description, amountPaise, paidById, splitType: expenseSplitType, exactAmounts, percentages, shareUnits, confirmDuplicate, confirmMerge }),
      });

      if (res.status === 409) {
        const data = await res.json();
        if (data.mergeCandidate) {
          const ok = await confirm({
            title: "Merge expense?",
            message: data.message,
            confirmLabel: "Merge into existing",
          });
          if (ok) await addExpense(false, true);
          return;
        } else {
          const ok = await confirm({
            title: "Possible duplicate",
            message: data.message,
            confirmLabel: "Add anyway",
          });
          if (ok) await addExpense(true, false);
          return;
        }
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add expense");
        return;
      }

      const expense = await res.json();
      // A merge updates an EXISTING expense — replace it in place instead of prepending a duplicate row
      setExpenses((prev) => {
        const alreadyThere = prev.some((e) => e.id === expense.id);
        return alreadyThere
          ? prev.map((e) => (e.id === expense.id ? expense : e))
          : [expense, ...prev];
      });
      setDescription("");
      setAmount("");
      loadSummary();
    } finally {
      setAddingExpense(false);
    }
  }

  // a) Add member — adds loading
  async function addMember() {
    if (!memberEmail.trim()) return;
    const ok = await confirm({
      title: "Add member?",
      message: `Are you sure you want to add "${memberEmail}" to this group?`,
      confirmLabel: "Add",
    });
    if (!ok) return;

    setMemberError(null);
    setAddingMember(true);
    try {
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
      await loadGroup();
      await loadSummary();
    } finally {
      setAddingMember(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      {(() => {
        const actionLoading =
          addingMember ||
          generatingInvite ||
          addingPlaceholder ||
          addingExpense ||
          savingEdit ||
          deletingExpenseId !== null ||
          requestingPermissionId !== null;

        if (initialLoading) return <PageLoader label="Loading group" />;
        if (actionLoading) {
          const label = addingMember
            ? "Adding member"
            : generatingInvite
            ? "Generating invite link"
            : addingPlaceholder
            ? "Adding placeholder"
            : addingExpense
            ? "Saving expense"
            : savingEdit
            ? "Saving changes"
            : deletingExpenseId !== null
            ? "Deleting expense"
            : "Sending request";
          return <PageLoader label={label} />;
        }
        return null;
      })()}

      <Link href="/dashboard" style={{ fontSize: 14, color: "#888" }}>
        ← Back to dashboard
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
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

      {/* a) Add member */}
      <input placeholder="Member's email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
      <button onClick={addMember} disabled={!memberEmail || addingMember}>
        {addingMember ? <Spinner /> : "Add member"}
      </button>
      {memberError && <p style={{ color: "red" }}>{memberError}</p>}

      {/* b) Generate invite link */}
      <button onClick={generateInvite} disabled={generatingInvite}>
        {generatingInvite ? <Spinner /> : "Generate invite link"}
      </button>
      {inviteLink && (
        <div style={{ marginTop: 8 }}>
          <input value={inviteLink} readOnly style={{ width: "100%" }} />
          <button onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</button>
          <p style={{ fontSize: 12, color: "#888" }}>Valid 7 days — share via WhatsApp or copy.</p>
        </div>
      )}

      {/* c) Add placeholder member */}
      <button onClick={() => setShowPlaceholder(!showPlaceholder)}>Add placeholder member</button>
      {showPlaceholder && (
        <div>
          <input placeholder="Name (required)" value={placeholderName} onChange={(e) => setPlaceholderName(e.target.value)} />
          <input placeholder="Phone (optional)" value={placeholderPhone} onChange={(e) => setPlaceholderPhone(e.target.value)} />
          <button onClick={addPlaceholder} disabled={!placeholderName || addingPlaceholder}>
            {addingPlaceholder ? <Spinner /> : "Add placeholder"}
          </button>
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

      {/* d) & f) Add expense — merge/duplicate handling now happens inside addExpense via modals */}
      <button onClick={() => addExpense(false, false)} disabled={addingExpense}>
        {addingExpense ? <Spinner /> : "Add"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {summary && <GroupSummaryCards summary={summary} />}

      <h2>Expenses</h2>
      <GroupExpensesGrid
        expenses={expenses}
        currentUserId={currentUserId}
        myPermissions={myPermissions}
        deletingExpenseId={deletingExpenseId}
        requestingPermissionId={requestingPermissionId}
        onEdit={(expense) => {
          setEditingExpense(expense.id);
          setEditDesc(expense.description);
          setEditAmount((expense.amountPaise / 100).toString());
          setEditPaidById(expense.paidById);
        }}
        onDelete={deleteExpense}
        onRequestAccess={(expenseId) => requestEditPermission(expenseId, "edit")}
      />

      {editingExpense && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
          }}
        >
          <h3 style={{ margin: "0 0 8px" }}>Edit expense</h3>
          <input value={editDesc} onChange={(ev) => setEditDesc(ev.target.value)} />
          <input type="number" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)} />
          <select value={editPaidById} onChange={(ev) => setEditPaidById(ev.target.value)}>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => saveEditExpense(editingExpense)} disabled={savingEdit}>
              {savingEdit ? <Spinner /> : "Save"}
            </button>
            <button onClick={() => setEditingExpense(null)} disabled={savingEdit} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}