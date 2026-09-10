"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useOnlineStatus } from "@/components/useOnlineStatus";
import { enqueueExpense, generateClientId, getQueuedExpenses } from "@/lib/offline-queue";
import { syncQueuedExpenses } from "@/lib/sync-queue";
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
  const router = useRouter()
  const { id } = useParams();
  const { confirm, prompt } = useModal(); // added `prompt` for the arbitration note dialog
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

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const [addingMember, setAddingMember] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [addingPlaceholder, setAddingPlaceholder] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [addingExpenseLabel, setAddingExpenseLabel] = useState("Saving expense");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [requestingPermissionId, setRequestingPermissionId] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [myPermissions, setMyPermissions] = useState<Record<string, string>>({});
  const [pendingRequestIds, setPendingRequestIds] = useState<Record<string, string>>({});

  const [memberScores, setMemberScores] = useState<Record<string, any>>({});
  const notifiedPermissionsRef = useRef<Set<string>>(new Set());

  const [isAdmin, setIsAdmin] = useState(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [arbitratingId, setArbitratingId] = useState<string | null>(null);

  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState(30);
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [leavingGroup, setLeavingGroup] = useState(false);
  const [archivingGroup, setArchivingGroup] = useState(false);
  const isOnline = useOnlineStatus();
const [queuedCount, setQueuedCount] = useState(0);
const [syncing, setSyncing] = useState(false);
const [groupInfo, setGroupInfo] = useState<any>(null);
  const loadDisputes = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/disputes`);
    if (res.ok) {
      setIsAdmin(true);
      setDisputes(await res.json());
    } else {
      setIsAdmin(false);
    }
  }, [id]);
const refreshQueueCount = useCallback(async () => {
  const queued = await getQueuedExpenses();
  setQueuedCount(queued.filter((q) => q.groupId === id).length);
}, [id]);

useEffect(() => {
  refreshQueueCount();
}, [refreshQueueCount]);

useEffect(() => {
  if (!isOnline || queuedCount === 0) return;
  setSyncing(true);
  syncQueuedExpenses((groupId, expense) => {
    if (groupId === id) {
      setExpenses((prev) => {
        const filtered = prev.filter((e) => e.clientId !== expense.clientId);
        return [expense, ...filtered];
      });
    }
  }).then(async ({ synced, failed }) => {
    setSyncing(false);
    await refreshQueueCount();
    if (synced > 0) loadSummary();
    if (failed > 0) {
      await confirm({
        title: "Some expenses couldn't sync",
        message: `${failed} queued expense(s) failed to sync — check they're valid and try again.`,
        mode: "alert",
      });
    }
  });
}, [isOnline, queuedCount, id]);
  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  async function leaveGroup() {
  const ok = await confirm({
    title: "Leave this group?",
    message: "You'll be removed from this group. You can only leave once your balance is fully settled.",
    confirmLabel: "Leave group",
  });
  if (!ok) return;

  setLeavingGroup(true);
  try {
    const res = await fetch(`/api/groups/${id}/leave`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setLeavingGroup(false);
      await confirm({
        title: data.error === "balance_not_settled" ? "Settle up first" : "Couldn't leave",
        message: data.message || data.error,
        mode: "alert",
      });
      return;
    }

    router.push("/dashboard");
  } finally {
    setLeavingGroup(false);
  }
}

async function toggleArchive() {
  const currentlyArchived = groupInfo?.archived; // assumes you're storing the group's own archived flag somewhere in state — see note below
  const ok = await confirm({
    title: currentlyArchived ? "Unarchive this group?" : "Archive this group?",
    message: currentlyArchived
      ? "This group will reappear in the default dashboard view."
      : "This group will be hidden from the default dashboard view, but all data stays intact.",
    confirmLabel: currentlyArchived ? "Unarchive" : "Archive",
  });
  if (!ok) return;

  setArchivingGroup(true);
  try {
    const res = await fetch(`/api/groups/${id}/archive`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      await confirm({ title: "Couldn't archive", message: data.error, mode: "alert" });
      return;
    }
    router.push("/dashboard");
  } finally {
    setArchivingGroup(false);
  }
}
async function openStatementModal() {
  setLoadingStatement(true);
  setShowStatementModal(true);
  try {
    const res = await fetch(`/api/groups/${id}/statement?days=${statementPeriod}`);
    setStatementData(await res.json());
  } finally {
    setLoadingStatement(false);
  }
}

async function emailStatement() {
  setSendingEmail(true);
  try {
    const res = await fetch(`/api/groups/${id}/statement/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodDays: statementPeriod }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      await confirm({ title: "Something went wrong", message: "Unexpected response from server.", mode: "alert" });
      return;
    }

    if (!res.ok) {
      await confirm({ title: "Couldn't send statement", message: data?.error || "Please try again.", mode: "alert" });
      return;
    }

    await confirm({
      title: "Statement sent",
      message: `Emailed to ${data.sentTo} of ${data.totalMembers} members.`,
      mode: "alert",
    });
  } finally {
    setSendingEmail(false);
  }
}

function shareViaWhatsApp() {
  if (!statementData) return;
  const rupees = (p: number) => (p / 100).toFixed(2);
  const lines = [
    `*${statementData.groupName} — ${statementData.periodDays}-day statement*`,
    ``,
    `Total spent: ₹${rupees(statementData.totalSpentPaise)} (${statementData.expenseCount} expenses)`,
    ``,
    `*Balances:*`,
    ...statementData.currentBalances.map(
      (b: any) => `${b.name}: ${b.amountPaise >= 0 ? "is owed" : "owes"} ₹${rupees(Math.abs(b.amountPaise))}`
    ),
  ];
  const text = encodeURIComponent(lines.join("\n"));
  window.open(`https://wa.me/?text=${text}`, "_blank");
}
  // Rewritten: uses the modal's prompt() dialog instead of the native
  // window.prompt(). Sequencing: dialog opens first (no loader behind it,
  // since nothing is loading yet) -> user types a note and clicks OK ->
  // dialog closes -> loader appears while the actual API call runs.
  async function arbitrate(settlementId: string, decision: "payer" | "payee") {
    const note = await prompt({
      title: decision === "payer" ? "Resolve in favor of the payer" : "Resolve in favor of the payee",
      message:
        decision === "payer"
          ? "Why are you siding with the payer? (e.g. you saw the cash change hands, UTR matches their bank statement)"
          : "Why are you siding with the payee? (e.g. no matching transaction found, they say nothing arrived)",
      placeholder: "Explain your decision...",
      confirmLabel: "Resolve",
      required: true,
    });
    if (!note) return; // cancelled — no loader, no API call

    setArbitratingId(settlementId); // loader appears only after the dialog is confirmed
    try {
      const res = await fetch(`/api/settlements/${settlementId}/arbitrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setArbitratingId(null); // clear loader BEFORE opening the error dialog
        await confirm({ title: "Couldn't resolve", message: data.error, mode: "alert" });
        return;
      }
      await loadDisputes();
    } finally {
      setArbitratingId(null);
    }
  }

  const loadGroup = useCallback(async () => {
  const res = await fetch(`/api/groups/${id}`);
  const group = await res.json();
  if (!group || !group.members) return;
  setGroupInfo(group); // NEW — store the group record itself (includes `archived`)
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

  const loadRecurringTemplates = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/recurring`);
    if (res.ok) setRecurringTemplates(await res.json());
  }, [id]);

  const loadPendingRequests = useCallback(() => {
  return fetch(`/api/edit-permissions/pending?groupId=${id}`)
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) setPendingRequests(data);
    })
    .catch(() => {}); // NEW — swallow network errors (e.g. offline) instead of crashing
}, [id]);

  const loadMyPermissions = useCallback(() => {
    return fetch(`/api/edit-permissions/my-requests?groupId=${id}`)
    .then((r) => r.json())
    .then(async (data: any[]) => {
        if (!Array.isArray(data)) return;

        const map: Record<string, string> = {};
        const idMap: Record<string, string> = {};

        for (const p of data) {
          if (!p.expense) continue;

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
            delete map[p.expenseId];
            delete idMap[p.expenseId];
          }
        }

        setMyPermissions(map);
        setPendingRequestIds(idMap);
      }).catch(() => {});
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
  if (document.visibilityState === "visible" && navigator.onLine) { // NEW — added navigator.onLine check
    loadPendingRequests();
    loadMyPermissions();
  }
}, 8000);

    function handleFocusOrVisible() {
  if (document.visibilityState === "visible" && navigator.onLine) { // NEW
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

  useEffect(() => {
    if (members.length === 0) return;
    Promise.all(
      members.map((m: any) =>
        fetch(`/api/user/${m.userId}/trust-score`).then((r) => r.json()).then((data) => [m.userId, data])
      )
    ).then((results) => {
      setMemberScores(Object.fromEntries(results));
    });
  }, [members]);

  function scoreBadgeColor(score: number) {
    if (score >= 90) return { bg: "#14532d", text: "#86efac" };
    if (score >= 75) return { bg: "#1a2e05", text: "#a3e635" };
    if (score >= 55) return { bg: "#451a03", text: "#fbbf24" };
    return { bg: "#1c1917", text: "#fb923c" };
  }

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadExpenses(),
      loadGroup(),
      loadSummary(),
      loadPendingRequests(),
      loadMyPermissions(),
      loadRecurringTemplates(),
      loadDisputes(),
    ]);
  }, [loadExpenses, loadGroup, loadSummary, loadPendingRequests, loadMyPermissions, loadRecurringTemplates, loadDisputes]);

  async function respondToRequest(permissionId: string, decision: "approved" | "denied") {
    await fetch(`/api/edit-permissions/${permissionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadPendingRequests();
  }

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

  async function addExpense(confirmDuplicate = false, confirmMerge = false) {
  if (!confirmDuplicate && !confirmMerge) {
    if (!description.trim() || !amount) return;
  }

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

  const payload = { description, amountPaise, paidById, splitType: expenseSplitType, exactAmounts, percentages, shareUnits };

  // ── NEW: offline path — queue locally, show an optimistic entry ──
  if (!isOnline && !confirmDuplicate && !confirmMerge) {
    const clientId = generateClientId();
    await enqueueExpense({ clientId, groupId: id as string, payload, createdAt: Date.now() });

    const payerName = members.find((m) => m.userId === paidById)?.user?.name || "Someone";
    setExpenses((prev) => [
      {
        id: `pending-${clientId}`,
        clientId,
        description,
        amountPaise,
        paidById,
        paidBy: { name: payerName },
        splitType: expenseSplitType,
        splits: [],
        payments: [],
        pendingSync: true,
      },
      ...prev,
    ]);

    setDescription("");
    setAmount("");
    setExactInputs({});
    setPercentInputs({});
    setShareInputs({});
    setExpenseSplitType("EQUAL");
    setShowExpenseModal(false);
    await refreshQueueCount();
    return;
  }

  setAddingExpense(true);
  setAddingExpenseLabel(
    confirmMerge ? `Merging "${description.trim()}"` : "Saving expense"
  );
  try {
    const clientId = generateClientId(); // NEW — always attach, so a mid-request drop can be safely retried

    const res = await fetch(`/api/groups/${id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amountPaise, paidById, splitType: expenseSplitType, exactAmounts, percentages, shareUnits, confirmDuplicate, confirmMerge, clientId }),
    });

    if (res.status === 409) {
      const data = await res.json();
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
  } catch (networkErr) {
    // NEW — genuine mid-request network failure: fall back to queuing
    // instead of losing the user's input entirely.
    setAddingExpense(false);
    const clientId = generateClientId();
    await enqueueExpense({ clientId, groupId: id as string, payload, createdAt: Date.now() });
    await refreshQueueCount();
    await confirm({
      title: "Connection lost",
      message: "Your expense has been saved and will sync automatically once you're back online.",
      mode: "alert",
    });
    setShowExpenseModal(false);
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

  const actionLoading =
    addingMember ||
    generatingInvite ||
    addingPlaceholder ||
    addingExpense ||
    savingEdit ||
    deletingExpenseId !== null ||
    requestingPermissionId !== null ||
    arbitratingId !== null; // arbitration loader now included in the combined overlay flag

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
                  : arbitratingId !== null
                    ? "Resolving dispute"
                    : "";

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={initialLoading || actionLoading} label={loaderLabel} />

      <Link href="/dashboard" style={{ fontSize: 14, color: "#888" }}>
        ← Back to dashboard
      </Link>
{!isOnline && (
  <div style={{ padding: "8px 14px", background: "#451a03", border: "1px solid #92400e", borderRadius: 6, margin: "12px 0", fontSize: 13, color: "#fbbf24" }}>
    📡 You're offline — new expenses will be saved locally and synced automatically once you're back online.
  </div>
)}
{isOnline && queuedCount > 0 && (
  <div style={{ padding: "8px 14px", background: "#172554", border: "1px solid #1e40af", borderRadius: 6, margin: "12px 0", fontSize: 13, color: "#93c5fd" }}>
    {syncing ? "🔄 Syncing queued expenses..." : `🔄 ${queuedCount} queued expense(s) waiting to sync`}
  </div>
)}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <h1 style={{ margin: 0 }}>Group</h1>
    <RefreshButton onRefresh={refreshAll} label="Refreshing your group" />
    {groupInfo?.archived && (
      <span style={{ fontSize: 10, background: "#333", color: "#999", padding: "2px 6px", borderRadius: 4 }}>
        Archived
      </span>
    )}
  </div>
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <button onClick={leaveGroup} disabled={leavingGroup} style={{ fontSize: 13, color: "#f87171", background: "none", border: "1px solid #7f1d1d", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
      {leavingGroup ? <Spinner /> : "Leave group"}
    </button>
    {isAdmin && (
      <button onClick={toggleArchive} disabled={archivingGroup} style={{ fontSize: 13, color: "#888", background: "none", border: "1px solid #444", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
        {archivingGroup ? <Spinner /> : groupInfo?.archived ? "Unarchive group" : "Archive group"}
      </button>
    )}
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
</div>

      <Link href={`/groups/${id}/balances`}>View balances</Link>
      {" | "}
      <Link href={`/groups/${id}/settle`}>Settle up</Link>
      {" | "}
      <Link href={`/groups/${id}/recurring`}>Recurring expenses</Link>

      <h2>Members</h2>
      <ul>
        {members.map((m) => {
          const ts = memberScores[m.userId];
          const badge = ts ? scoreBadgeColor(ts.score) : null;
          return (
            <li key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span>
                {m.user.name || m.user.email}
                {m.userId === currentUserId && (
                  <span style={{ color: "#888", fontSize: 12, marginLeft: 6 }}>(me)</span>
                )}
              </span>
              {ts && ts.totalSettlements > 0 && (
                <span
                  title={`${ts.label} — based on ${ts.totalSettlements} settlements`}
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: badge!.bg,
                    color: badge!.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ts.score} · {ts.label}
                </span>
              )}
              {ts && ts.totalSettlements === 0 && (
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#1c1917", color: "#888" }}>
                  New member
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <button onClick={() => setShowAddMemberModal(true)}>Add member</button>

      <button onClick={generateInvite} disabled={generatingInvite}>
        {generatingInvite ? <Spinner /> : "Generate invite link"}
      </button>

      <button onClick={() => setShowPlaceholderModal(true)}>Add placeholder member</button>

      <button onClick={openExpenseModal}>Add expense</button>
<button onClick={openStatementModal}>📊 Generate statement</button>
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

      {/* Disputes to resolve — admin only. "Payer's claim" is what the person
          who owed money says happened; "Payee's dispute" is what the person
          who was supposed to receive it says instead. As admin, you're
          deciding which claim to trust since cash payments have no independent proof. */}
      {isAdmin && disputes.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 4px", color: "#f87171" }}>
            ⚠ Disputes to resolve ({disputes.length})
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "#888" }}>
            As group admin, review both sides and decide which claim to trust.
          </p>
          {disputes.map((d) => (
            <div key={d.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #333" }}>
              <p style={{ margin: "0 0 6px", fontSize: 14 }}>
                <strong>{d.fromName}</strong> → <strong>{d.toName}</strong>: ₹{(d.amountPaise / 100).toFixed(2)}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div style={{ background: "#111", padding: 8, borderRadius: 6 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 11, color: "#888" }}>PAYER'S CLAIM</p>
                  <p style={{ margin: "0 0 4px", fontSize: 10, color: "#666" }}>
                    What {d.fromName} says they did
                  </p>
                  <p style={{ margin: 0, fontSize: 12 }}>
                    {d.paymentMethod === "cash" ? "Paid in cash" : "Paid via UPI"}
                    {d.utrNumber && <><br />UTR: {d.utrNumber}</>}
                  </p>
                  {d.evidenceUrl && (
                    <a href={d.evidenceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#60a5fa" }}>
                      View screenshot →
                    </a>
                  )}
                </div>
                <div style={{ background: "#111", padding: 8, borderRadius: 6 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 11, color: "#888" }}>PAYEE'S DISPUTE</p>
                  <p style={{ margin: "0 0 4px", fontSize: 10, color: "#666" }}>
                    What {d.toName} says happened instead
                  </p>
                  <p style={{ margin: 0, fontSize: 12 }}>{d.disputeReason}</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => arbitrate(d.id, "payer")}
                  disabled={arbitratingId === d.id}
                  style={{ fontSize: 12, background: "#14532d", color: "#86efac", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}
                >
                  Resolve for payer
                </button>
                <button
                  onClick={() => arbitrate(d.id, "payee")}
                  disabled={arbitratingId === d.id}
                  style={{ fontSize: 12, background: "#450a0a", color: "#fca5a5", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer" }}
                >
                  Resolve for payee
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
{showStatementModal && (
  <Dialog
    icon="📊"
    iconColor="#2563eb"
    title="Group statement"
    onBackdropClick={() => setShowStatementModal(false)}
    width={480}
    footer={
      <>
        <DialogButton variant="secondary" onClick={() => setShowStatementModal(false)}>Close</DialogButton>
        <DialogButton onClick={shareViaWhatsApp} disabled={!statementData}>📱 Share via WhatsApp</DialogButton>
        <DialogButton onClick={emailStatement} disabled={!statementData || sendingEmail}>
          {sendingEmail ? <Spinner /> : "📧 Email to all members"}
        </DialogButton>
      </>
    }
  >
    <select value={statementPeriod} onChange={(e) => { setStatementPeriod(Number(e.target.value)); openStatementModal(); }}>
      <option value={7}>Last 7 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>

    {loadingStatement && <Spinner />}

    {statementData && !loadingStatement && (
  <div style={{ fontSize: 13 }}>
    <p>Total spent: ₹{(statementData.totalSpentPaise / 100).toFixed(2)} ({statementData.expenseCount} expenses)</p>
    <p>Settlements: {statementData.settlementsConfirmed}/{statementData.settlementsInPeriod} confirmed</p>

    <h4>Payment status</h4>
    {statementData.settlements.length === 0 && <p style={{ color: "#888" }}>No settlement attempts this period.</p>}
    {statementData.settlements.map((s: any, i: number) => {
      const label =
        s.status === "both_confirmed" ? { text: "✓ Paid & confirmed", color: "#86efac" } :
        s.status === "payer_confirmed" ? { text: "⏳ Awaiting confirmation", color: "#fbbf24" } :
        s.status === "disputed" ? { text: "⚠ Disputed", color: "#f87171" } :
        { text: "✗ Not yet paid", color: "#f87171" };
      return (
        <p key={i} style={{ margin: "4px 0" }}>
          {s.fromName} → {s.toName}: ₹{(s.amountPaise / 100).toFixed(2)} —{" "}
          <span style={{ color: label.color }}>{label.text}</span>
        </p>
      );
    })}

    <h4>Still pending</h4>
    {statementData.stillOwing.length === 0 && <p style={{ color: "#86efac" }}>Everyone is settled up ✓</p>}
    {statementData.stillOwing.map((p: any, i: number) => (
      <p key={i} style={{ color: "#f87171", margin: "4px 0" }}>
        {p.name}: ₹{(p.amountPaise / 100).toFixed(2)} still owed
      </p>
    ))}

    <h4>Balances</h4>
    {statementData.currentBalances.map((b: any, i: number) => (
      <p key={i} style={{ color: b.amountPaise >= 0 ? "#86efac" : "#f87171" }}>
        {b.name}: {b.amountPaise >= 0 ? "is owed" : "owes"} ₹{(Math.abs(b.amountPaise) / 100).toFixed(2)}
      </p>
    ))}
  </div>
)}
  </Dialog>
)}
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