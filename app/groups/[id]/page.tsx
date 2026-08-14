"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";
import GroupSummaryCards from "@/components/GroupSummaryCards";
import GroupExpensesGrid from "@/components/GroupExpensesGrid";
import GroupRecurringGrid from "@/components/GroupRecurringGrid";
import NotificationBell from "@/components/NotificationBell";
import type { GroupSummary } from "@/lib/group-summary";

type RecurringTemplateRow = {
  id: string;
  description: string;
  amountPaise: number;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
  frequencyDays: number;
  active: boolean;
  nextRunAt: string | null;
  pausedAt: string | null;
  nextCycleOverride?: {
    amountPaise: number;
    note?: string;
  } | null;
};

type PendingRequest = {
  id: string;
  action: string;
  requestedBy: { name?: string | null; email?: string | null };
  expense: { description: string; amountPaise: number };
};

// Shared dialog chrome — mirrors the existing "Edit expense" modal's look
// (dark card, icon title bar, footer buttons) so all dialogs stay consistent.
function Dialog({
  icon,
  iconColor,
  title,
  onBackdropClick,
  children,
  footer,
  width = 400,
}: {
  icon: string;
  iconColor: string;
  title: string;
  onBackdropClick: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 90vw)`,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #333",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          background: "#161616",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)",
            borderBottom: "1px solid #2a2a2a",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: iconColor,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#eee" }}>{title}</span>
        </div>

        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflowY: "auto",
          }}
        >
          {children}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "12px 16px",
            background: "#141414",
            borderTop: "1px solid #2a2a2a",
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

function DialogButton({
  onClick,
  disabled,
  variant = "primary",
  children,
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
        padding: "6px 16px",
        borderRadius: 6,
        border: isPrimary ? "none" : "1px solid #444",
        background: isPrimary ? "#2563eb" : "transparent",
        color: isPrimary ? "#fff" : "#ccc",
        fontWeight: isPrimary ? 600 : 400,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

export default function GroupDetailPage() {
  const { id } = useParams();
  const { confirm } = useModal();
  const [initialLoading, setInitialLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<GroupSummary | null>(null);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplateRow[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [placeholderName, setPlaceholderName] = useState("");
  const [placeholderPhone, setPlaceholderPhone] = useState("");
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaidById, setEditPaidById] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState("EQUAL");
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});

  // Dialog visibility — one per modal-based action
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Loading states — one per listed action
  const [addingMember, setAddingMember] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [addingPlaceholder, setAddingPlaceholder] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  // Lets the overlay say "Saving expense" vs. "Merging "food"" depending on
  // which branch of addExpense() is running, instead of a single fixed label.
  const [addingExpenseLabel, setAddingExpenseLabel] = useState("Saving expense");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [requestingPermissionId, setRequestingPermissionId] = useState<string | null>(null);

  // Permission system state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]); // for owner
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

  // Same endpoint the /recurring page reads from — kept in sync here via
  // the initial load, the focus/visibility refetch, and refreshAll, so a
  // template deleted on /recurring disappears from this page's table too
  // as soon as the user comes back, without any special-case wiring.
  const loadRecurringTemplates = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/recurring`);
    if (res.ok) setRecurringTemplates(await res.json());
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
    Promise.all([
      loadExpenses(),
      loadGroup(),
      loadSummary(),
      loadPendingRequests(),
      loadMyPermissions(),
      loadRecurringTemplates(),
    ]).finally(() => setInitialLoading(false));

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPendingRequests();
        loadMyPermissions();
      }
    }, 8000);

    // Refetch balances/expenses/recurring templates immediately when the
    // user comes back to this tab/page (e.g. after settling a payment on
    // /settle, or deleting/pausing a template on /recurring, and
    // navigating back) instead of waiting for the next poll tick or a full
    // remount.
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        loadSummary();
        loadExpenses();
        loadRecurringTemplates();
      }
    }
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [id, loadExpenses, loadGroup, loadSummary, loadPendingRequests, loadMyPermissions, loadRecurringTemplates]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadExpenses(),
      loadGroup(),
      loadSummary(),
      loadPendingRequests(),
      loadMyPermissions(),
      loadRecurringTemplates(),
    ]);
  }, [loadExpenses, loadGroup, loadSummary, loadPendingRequests, loadMyPermissions, loadRecurringTemplates]);

  async function respondToRequest(permissionId: string, decision: "approved" | "denied") {
    await fetch(`/api/edit-permissions/${permissionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadPendingRequests();
  }

  // e) Request edit access — replaces alert() with modal, adds per-expense loading.
  // The overlay is cleared *before* any confirm()/info dialog is awaited —
  // otherwise the full-page loader stays on top of the dialog and blocks
  // clicks on its buttons until the dialog itself resolves.
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
        setRequestingPermissionId(null);
        await confirm({
          title: "Already requested",
          message: "You've already requested this — waiting on the expense creator to respond.",
          mode: "alert",
        });
        setMyPermissions((prev) => ({ ...prev, [expenseId]: "pending" }));
        return;
      } else {
        setRequestingPermissionId(null);
        await confirm({
          title: "Request sent",
          message: "The creator of this expense has been notified. You'll see an update here once they respond.",
          mode: "alert",
        });
        setMyPermissions((prev) => ({ ...prev, [expenseId]: "pending" }));
        return;
      }
    } finally {
      setRequestingPermissionId(null);
    }
  }

  // e) Delete expense — native confirm() replaced with modal, adds per-expense loading.
  // Same overlay-before-dialog fix as above.
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
          setDeletingExpenseId(null);
          await requestEditPermission(expenseId, "delete");
          return;
        }
        setDeletingExpenseId(null);
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

  // e) Save edit — alert() replaced with modal, adds loading.
  // Same overlay-before-dialog fix as above.
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
          setSavingEdit(false);
          await confirm({
            title: "Permission needed",
            message: "You need permission from the expense creator to edit this.",
            mode: "alert",
          });
          return;
        }
        setSavingEdit(false);
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

  // b) Generate invite link — generates immediately, then opens a dialog
  // showing the link. OK-only (no cancel): once generated, there's nothing
  // to "cancel", just acknowledge and close.
  async function generateInvite() {
    setGeneratingInvite(true);
    try {
      const res = await fetch(`/api/groups/${id}/invite`, { method: "POST" });
      const data = await res.json();
      setInviteLink(data.link);
      setShowInviteModal(true);
    } finally {
      setGeneratingInvite(false);
    }
  }

  function closeInviteModal() {
    setShowInviteModal(false);
    setInviteLink(null);
  }

  // c) Add placeholder member — dialog-based, OK/Cancel
  async function addPlaceholder() {
    if (!placeholderName.trim()) return;
    setAddingPlaceholder(true);
    try {
      await fetch(`/api/groups/${id}/placeholder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: placeholderName, phone: placeholderPhone }),
      });
      setPlaceholderName("");
      setPlaceholderPhone("");
      setShowPlaceholderModal(false);
      await loadGroup();
      await loadSummary();
    } finally {
      setAddingPlaceholder(false);
    }
  }

  function closePlaceholderModal() {
    if (addingPlaceholder) return;
    setShowPlaceholderModal(false);
    setPlaceholderName("");
    setPlaceholderPhone("");
  }

  // d) & f) Add expense — duplicate/merge warnings shown as modals, adds loading.
  // Now triggered from the "Add expense" dialog's OK button instead of an
  // inline "are you sure" confirm — the dialog itself is the confirmation step.
  //
  // Loader handling: the overlay is shown while the create call is checking
  // for a duplicate/merge candidate, then hidden the instant we know we need
  // to ask the user something (409 response) so it never overlaps the
  // "Merge expense?" / "Possible duplicate" confirm dialogs. It's switched
  // back on — with a merge-specific label — only once the user actually
  // confirms and the real save/merge request goes out.
  async function addExpense(confirmDuplicate = false, confirmMerge = false) {
    if (!confirmDuplicate && !confirmMerge) {
      if (!description.trim() || !amount) return;
    }

    setError(null);
    setAddingExpense(true);
    setAddingExpenseLabel(
      confirmMerge ? `Merging "${description.trim()}"` : "Saving expense"
    );
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
        // Duplicate/merge check is done — nothing is being saved yet, so
        // drop the loader before the confirm dialog opens instead of
        // stacking them.
        setAddingExpense(false);

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
      setExactInputs({});
      setPercentInputs({});
      setShareInputs({});
      setExpenseSplitType("EQUAL");
      setShowExpenseModal(false);
      loadSummary();
    } finally {
      setAddingExpense(false);
    }
  }

  function openExpenseModal() {
    setError(null);
    if (members.length > 0 && !paidById) setPaidById(members[0].userId);
    setShowExpenseModal(true);
  }

  function closeExpenseModal() {
    if (addingExpense) return;
    setShowExpenseModal(false);
    setError(null);
  }

  // a) Add member — dialog-based, OK/Cancel
  async function addMember() {
    if (!memberEmail.trim()) return;
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
      setShowAddMemberModal(false);
      await loadGroup();
      await loadSummary();
    } finally {
      setAddingMember(false);
    }
  }

  function closeAddMemberModal() {
    if (addingMember) return;
    setShowAddMemberModal(false);
    setMemberEmail("");
    setMemberError(null);
  }

  function openEditModal(expense: any) {
    setEditingExpense(expense.id);
    setEditDesc(expense.description);
    setEditAmount((expense.amountPaise / 100).toString());
    setEditPaidById(expense.paidById);
  }

  // Combined visible/label logic for the overlay — one flag covers both the
  // initial page load and any in-flight action.
  const actionLoading =
    addingMember ||
    generatingInvite ||
    addingPlaceholder ||
    addingExpense ||
    savingEdit ||
    deletingExpenseId !== null ||
    requestingPermissionId !== null;

  const loaderLabel = initialLoading
    ? "Loading group"
    : addingMember
    ? "Adding member"
    : generatingInvite
    ? "Generating invite link"
    : addingPlaceholder
    ? "Adding placeholder"
    : addingExpense
    ? addingExpenseLabel
    : savingEdit
    ? "Saving changes"
    : deletingExpenseId !== null
    ? "Deleting expense"
    : requestingPermissionId !== null
    ? "Sending request"
    : "";

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={initialLoading || actionLoading} label={loaderLabel} />

      <Link href="/dashboard" style={{ fontSize: 14, color: "#888" }}>
        ← Back to dashboard
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ margin: 0 }}>Group</h1>
          <RefreshButton onRefresh={refreshAll} label="Refreshing your group" />
        </div>
        <NotificationBell<PendingRequest>
          items={pendingRequests}
          getKey={(req) => req.id}
          renderItem={(req) => (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>
                <strong>{req.requestedBy.name || req.requestedBy.email}</strong> wants to{" "}
                <strong>{req.action}</strong> "{req.expense.description}" — ₹
                {(req.expense.amountPaise / 100).toFixed(2)}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => respondToRequest(req.id, "approved")}
                  style={{ flex: 1, background: "#16a34a", color: "#fff", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => respondToRequest(req.id, "denied")}
                  style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                >
                  ✗ Deny
                </button>
              </div>
            </>
          )}
        />
      </div>

      <Link href={`/groups/${id}/balances`}>View balances</Link>
      {" | "}
      <Link href={`/groups/${id}/settle`}>Settle up</Link>
      {" | "}
      <Link href={`/groups/${id}/recurring`}>Recurring expenses</Link>

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

      {/* a) Add member — opens dialog */}
      <button onClick={() => setShowAddMemberModal(true)}>Add member</button>

      {/* b) Generate invite link — generates then opens dialog */}
      <button onClick={generateInvite} disabled={generatingInvite}>
        {generatingInvite ? <Spinner /> : "Generate invite link"}
      </button>

      {/* c) Add placeholder member — opens dialog */}
      <button onClick={() => setShowPlaceholderModal(true)}>Add placeholder member</button>

      {/* d) & f) Add expense — opens dialog */}
      <button onClick={openExpenseModal}>Add expense</button>

      {summary && <GroupSummaryCards summary={summary} recurringTemplates={recurringTemplates} />}

      <h2>Expenses</h2>
      <GroupExpensesGrid
        expenses={expenses}
        currentUserId={currentUserId}
        myPermissions={myPermissions}
        deletingExpenseId={deletingExpenseId}
        requestingPermissionId={requestingPermissionId}
        onEdit={openEditModal}
        onDelete={deleteExpense}
        onRequestAccess={(expenseId) => requestEditPermission(expenseId, "edit")}
      />

      {/* Recurring expenses — separate table from the Expenses grid above:
          this lists the *templates*, not individual generated expenses.
          Read-only here; create/edit/pause/delete happens on the
          /recurring page. Kept in sync via loadRecurringTemplates, so a
          deleted template drops out of this list automatically. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>Recurring expenses</h2>
        <Link href={`/groups/${id}/recurring`} style={{ fontSize: 13, color: "#93c5fd" }}>
          Manage →
        </Link>
      </div>

      {recurringTemplates.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13.5 }}>No recurring templates yet.</p>
      ) : (
        <GroupRecurringGrid templates={recurringTemplates} />
      )}

      {/* Add member dialog */}
      {showAddMemberModal && (
        <Dialog
          icon="＋"
          iconColor="#2563eb"
          title="Add member"
          onBackdropClick={closeAddMemberModal}
          footer={
            <>
              <DialogButton variant="secondary" onClick={closeAddMemberModal} disabled={addingMember}>
                Cancel
              </DialogButton>
              <DialogButton onClick={addMember} disabled={!memberEmail || addingMember}>
                {addingMember ? <Spinner /> : "OK"}
              </DialogButton>
            </>
          }
        >
          <input
            placeholder="Member's email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            style={{ width: "100%" }}
            autoFocus
          />
          {memberError && <p style={{ color: "red", fontSize: 12, margin: 0 }}>{memberError}</p>}
        </Dialog>
      )}

      {/* Add placeholder member dialog */}
      {showPlaceholderModal && (
        <Dialog
          icon="＋"
          iconColor="#6b7280"
          title="Add placeholder member"
          onBackdropClick={closePlaceholderModal}
          footer={
            <>
              <DialogButton variant="secondary" onClick={closePlaceholderModal} disabled={addingPlaceholder}>
                Cancel
              </DialogButton>
              <DialogButton onClick={addPlaceholder} disabled={!placeholderName || addingPlaceholder}>
                {addingPlaceholder ? <Spinner /> : "OK"}
              </DialogButton>
            </>
          }
        >
          <input
            placeholder="Name (required)"
            value={placeholderName}
            onChange={(e) => setPlaceholderName(e.target.value)}
            style={{ width: "100%" }}
            autoFocus
          />
          <input
            placeholder="Phone (optional)"
            value={placeholderPhone}
            onChange={(e) => setPlaceholderPhone(e.target.value)}
            style={{ width: "100%" }}
          />
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            No app required — included in splits but can't log in.
          </p>
        </Dialog>
      )}

      {/* Generate invite link dialog */}
      {showInviteModal && inviteLink && (
        <Dialog
          icon="🔗"
          iconColor="#16a34a"
          title="Invite link"
          onBackdropClick={closeInviteModal}
          footer={<DialogButton onClick={closeInviteModal}>OK</DialogButton>}
        >
          <input value={inviteLink} readOnly style={{ width: "100%" }} />
          <DialogButton variant="secondary" onClick={() => navigator.clipboard.writeText(inviteLink)}>
            Copy link
          </DialogButton>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            Valid 7 days — share via WhatsApp or copy.
          </p>
        </Dialog>
      )}

      {/* Add expense dialog */}
      {showExpenseModal && (
        <Dialog
          icon="₹"
          iconColor="#2563eb"
          title="Add expense"
          onBackdropClick={closeExpenseModal}
          width={440}
          footer={
            <>
              <DialogButton variant="secondary" onClick={closeExpenseModal} disabled={addingExpense}>
                Cancel
              </DialogButton>
              <DialogButton onClick={() => addExpense(false, false)} disabled={!description.trim() || !amount || addingExpense}>
                {addingExpense ? <Spinner /> : "Add"}
              </DialogButton>
            </>
          }
        >
          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%" }}
            autoFocus
          />
          <input
            placeholder="Amount (₹)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: "100%" }}
          />

          <label style={{ fontSize: 12, color: "#888" }}>Paid by</label>
          <select value={paidById} onChange={(e) => setPaidById(e.target.value)} style={{ width: "100%" }}>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name || m.user.email}{m.userId === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 12, color: "#888" }}>Split method</label>
          <select value={expenseSplitType} onChange={(e) => setExpenseSplitType(e.target.value)} style={{ width: "100%" }}>
            <option value="EQUAL">Split equally</option>
            <option value="EXACT">Exact amounts</option>
            <option value="PERCENTAGE">By percentage</option>
            <option value="SHARES">By shares</option>
          </select>

          {expenseSplitType === "EXACT" && (
            <div>
              <p style={{ fontSize: 12, color: "#888" }}>Enter how much each person owes exactly:</p>
              {members.map((m) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <label style={{ flex: 1 }}>{m.user.name || m.user.email}: ₹</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={exactInputs[m.userId] || ""}
                    onChange={(e) => setExactInputs({ ...exactInputs, [m.userId]: e.target.value })}
                    style={{ width: 90 }}
                  />
                </div>
              ))}
            </div>
          )}

          {expenseSplitType === "PERCENTAGE" && (
            <div>
              <p style={{ fontSize: 12, color: "#888" }}>Enter % each person owes (must total 100%):</p>
              {members.map((m) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <label style={{ flex: 1 }}>{m.user.name || m.user.email}: </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={percentInputs[m.userId] || ""}
                    onChange={(e) => setPercentInputs({ ...percentInputs, [m.userId]: e.target.value })}
                    style={{ width: 70 }}
                  />
                  <span>%</span>
                </div>
              ))}
            </div>
          )}

          {expenseSplitType === "SHARES" && (
            <div>
              <p style={{ fontSize: 12, color: "#888" }}>Enter share units (e.g. meals eaten):</p>
              {members.map((m) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <label style={{ flex: 1 }}>{m.user.name || m.user.email}: </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={shareInputs[m.userId] || ""}
                    onChange={(e) => setShareInputs({ ...shareInputs, [m.userId]: e.target.value })}
                    style={{ width: 70 }}
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p style={{ color: "red", fontSize: 12, margin: 0 }}>{error}</p>}
        </Dialog>
      )}

      {/* Edit expense — unchanged, rendered as a centered modal dialog */}
      {editingExpense && (
        <Dialog
          icon="✎"
          iconColor="#2563eb"
          title="Edit expense"
          onBackdropClick={() => !savingEdit && setEditingExpense(null)}
          footer={
            <>
              <DialogButton variant="secondary" onClick={() => setEditingExpense(null)} disabled={savingEdit}>
                Cancel
              </DialogButton>
              <DialogButton onClick={() => saveEditExpense(editingExpense)} disabled={savingEdit}>
                {savingEdit ? <Spinner /> : "Save"}
              </DialogButton>
            </>
          }
        >
          <input
            value={editDesc}
            onChange={(ev) => setEditDesc(ev.target.value)}
            placeholder="Description"
            style={{ width: "100%" }}
          />
          <input
            type="number"
            value={editAmount}
            onChange={(ev) => setEditAmount(ev.target.value)}
            placeholder="Amount (₹)"
            style={{ width: "100%" }}
          />
          <select
            value={editPaidById}
            onChange={(ev) => setEditPaidById(ev.target.value)}
            style={{ width: "100%" }}
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </select>
        </Dialog>
      )}
    </div>
  );
}