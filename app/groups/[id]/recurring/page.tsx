"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";

// Shared dialog chrome — same look as the group page's dialogs (dark card,
// icon title bar, footer buttons) so both pages stay visually consistent.
function Dialog({
  icon,
  iconColor,
  title,
  onBackdropClick,
  children,
  footer,
  width = 420,
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

export default function RecurringPage() {
  const { id } = useParams();
  const { confirm } = useModal();

  const [initialLoading, setInitialLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // ── Create template dialog state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState("EQUAL");
  const [frequencyDays, setFrequencyDays] = useState("30");
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // ── Edit dialog state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Prorate / override dialog state ──
  const [proratingId, setProratingId] = useState<string | null>(null);
  const [prorateAmount, setProrateAmount] = useState("");
  const [prorateNote, setProrateNote] = useState("");
  const [prorateExclude, setProrateExclude] = useState<string[]>([]);
  const [savingProrate, setSavingProrate] = useState(false);
  const [clearingProrateId, setClearingProrateId] = useState<string | null>(null);

  // ── Pause / resume + delete + run-now loading ──
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningNow, setRunningNow] = useState(false);

  async function load() {
    const res = await fetch(`/api/groups/${id}/recurring`);
    setTemplates(await res.json());
  }

  useEffect(() => {
    Promise.all([
      load(),
      fetch(`/api/groups/${id}`)
        .then((r) => r.json())
        .then((g) => {
          if (g?.members) setMembers(g.members);
        }),
    ]).finally(() => setInitialLoading(false));
  }, [id]);

  // ── Create template — opens dialog, OK creates and closes ──
  function openCreateModal() {
    setDescription("");
    setAmount("");
    setSplitType("EQUAL");
    setFrequencyDays("30");
    setShareInputs({});
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creatingTemplate) return;
    setShowCreateModal(false);
  }

  async function createTemplate() {
    if (!description.trim() || !amount) return;
    setCreatingTemplate(true);
    try {
      const amountPaise = Math.round(parseFloat(amount) * 100);
      const shareUnits =
        splitType === "SHARES"
          ? Object.fromEntries(
              Object.entries(shareInputs)
                .filter(([, v]) => v)
                .map(([userId, v]) => [userId, parseInt(v)])
            )
          : undefined;

      await fetch(`/api/groups/${id}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amountPaise,
          splitType,
          shareUnits,
          frequencyDays: parseInt(frequencyDays),
        }),
      });

      setDescription("");
      setAmount("");
      setShareInputs({});
      setShowCreateModal(false);
      await load();
    } finally {
      setCreatingTemplate(false);
    }
  }

  // ── Run due templates now — confirmation + result shown via modal instead of alert() ──
  async function runNow() {
    const ok = await confirm({
      title: "Run due recurring expenses?",
      message: "This generates expenses for every template that's currently due.",
      confirmLabel: "Run now",
    });
    if (!ok) return;

    setRunningNow(true);
    try {
      const res = await fetch("/api/cron/run-recurring", { method: "POST" });
      const data = await res.json();
      // Drop the loader before the result dialog opens — otherwise the
      // overlay sits behind/under the "Done" dialog instead of handing off.
      setRunningNow(false);
      await confirm({
        title: "Done",
        message: `Generated ${data.generated} expense(s).`,
        mode: "alert",
      });
      await load();
    } finally {
      setRunningNow(false);
    }
  }

  // ── Pause / resume — confirmation dialog instead of firing straight away ──
  async function togglePause(template: any) {
    const willPause = template.active;
    const ok = await confirm({
      title: willPause ? "Pause this expense?" : "Resume this expense?",
      message: willPause
        ? `"${template.description}" won't generate new expenses until you resume it.`
        : `"${template.description}" will start generating expenses again on schedule.`,
      confirmLabel: willPause ? "Pause" : "Resume",
    });
    if (!ok) return;

    setPausingId(template.id);
    try {
      const res = await fetch(`/api/groups/${id}/recurring/${template.id}/pause`, {
        method: "POST",
      });
      const data = await res.json();
      // Drop the loader before the result dialog opens — otherwise the
      // overlay sits behind/under the "Done" dialog instead of handing off.
      setPausingId(null);
      await confirm({ title: "Done", message: data.message, mode: "alert" });
      await load();
    } finally {
      setPausingId(null);
    }
  }

  // ── Delete — confirmation dialog instead of native confirm() ──
  async function deleteTemplate(template: any) {
    const ok = await confirm({
      title: "Delete this template?",
      message: `"${template.description}" will stop generating new expenses. Past expenses it already created won't be deleted.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    setDeletingId(template.id);
    try {
      await fetch(`/api/groups/${id}/recurring/${template.id}`, { method: "DELETE" });
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  // ── Edit dialog ──
  function openEditModal(t: any) {
    setEditingId(t.id);
    setEditDesc(t.description);
    setEditAmount((t.amountPaise / 100).toString());
    setEditFrequency(t.frequencyDays.toString());
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditingId(null);
  }

  async function saveEdit(templateId: string) {
    setSavingEdit(true);
    try {
      await fetch(`/api/groups/${id}/recurring/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editDesc,
          amountPaise: Math.round(parseFloat(editAmount) * 100),
          frequencyDays: parseInt(editFrequency),
        }),
      });
      setEditingId(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Prorate / override next cycle dialog ──
  function openProrateModal(t: any) {
    setProratingId(t.id);
    setProrateAmount("");
    setProrateNote("");
    setProrateExclude([]);
  }

  function closeProrateModal() {
    if (savingProrate) return;
    setProratingId(null);
  }

  async function saveProrate(templateId: string) {
    setSavingProrate(true);
    try {
      const body: any = {
        note: prorateNote || "Prorated cycle",
      };
      if (prorateAmount) {
        body.amountPaise = Math.round(parseFloat(prorateAmount) * 100);
      }
      if (prorateExclude.length > 0) {
        body.excludeUserIds = prorateExclude;
      }

      await fetch(`/api/groups/${id}/recurring/${templateId}/prorate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setProratingId(null);
      setProrateAmount("");
      setProrateNote("");
      setProrateExclude([]);
      await load();
      // Drop the loader before the result dialog opens — otherwise the
      // overlay sits behind/under the "Override saved" dialog instead of
      // handing off.
      setSavingProrate(false);
      await confirm({
        title: "Override saved",
        message: "It will apply on the next run, then revert to normal.",
        mode: "alert",
      });
    } finally {
      setSavingProrate(false);
    }
  }

  async function clearProrate(templateId: string) {
    const ok = await confirm({
      title: "Clear override?",
      message: "The next cycle will run at the template's normal amount instead.",
      confirmLabel: "Clear override",
    });
    if (!ok) return;

    setClearingProrateId(templateId);
    try {
      await fetch(`/api/groups/${id}/recurring/${templateId}/prorate`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setClearingProrateId(null);
    }
  }

  function toggleExclude(userId: string) {
    setProrateExclude((prev) =>
      prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId]
    );
  }

  // ── Combined loader overlay ──
  const actionLoading =
    creatingTemplate ||
    savingEdit ||
    savingProrate ||
    pausingId !== null ||
    deletingId !== null ||
    clearingProrateId !== null ||
    runningNow;

  const loaderLabel = initialLoading
    ? "Loading templates"
    : creatingTemplate
    ? "Creating template"
    : savingEdit
    ? "Saving changes"
    : savingProrate
    ? "Saving override"
    : pausingId !== null
    ? "Updating template"
    : deletingId !== null
    ? "Deleting template"
    : clearingProrateId !== null
    ? "Clearing override"
    : runningNow
    ? "Running due expenses"
    : "";

  const editingTemplate = templates.find((t) => t.id === editingId);
  const proratingTemplate = templates.find((t) => t.id === proratingId);

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={initialLoading || actionLoading} label={loaderLabel} />

      <Link href={`/groups/${id}`} style={{ fontSize: 13, color: "#888" }}>
        ← Back to group
      </Link>
      <h1>Recurring expenses</h1>

      {/* d) Create template — opens dialog */}
      <button onClick={openCreateModal}>Create template</button>

      {/* ── Active templates ── */}
      <h2>Templates</h2>
      {!initialLoading && templates.length === 0 && (
        <p style={{ color: "#888" }}>No recurring templates yet.</p>
      )}

      {templates.map((t) => (
        <div
          key={t.id}
          style={{
            border: `1px solid ${t.active ? "#2a2a2a" : "#451a03"}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            opacity: t.active ? 1 : 0.7,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontWeight: 600 }}>{t.description}</p>
              <p style={{ margin: "0 0 2px", fontSize: 13, color: "#888" }}>
                ₹{(t.amountPaise / 100).toFixed(2)} every {t.frequencyDays} days ({t.splitType})
              </p>
              <p style={{ margin: 0, fontSize: 12, color: t.active ? "#888" : "#f59e0b" }}>
                {t.active
                  ? `Next run: ${new Date(t.nextRunAt).toLocaleDateString()}`
                  : `⏸ Paused since ${new Date(t.pausedAt).toLocaleDateString()}`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => openEditModal(t)} style={{ fontSize: 12 }}>
                Edit
              </button>
              <button
                onClick={() => togglePause(t)}
                disabled={pausingId === t.id}
                style={{ fontSize: 12, color: t.active ? "#f59e0b" : "#86efac" }}
              >
                {pausingId === t.id ? <Spinner size={11} /> : t.active ? "⏸ Pause" : "▶ Resume"}
              </button>
              <button
                onClick={() => openProrateModal(t)}
                style={{ fontSize: 12, color: "#93c5fd" }}
              >
                🔧 Override next cycle
              </button>
              <button
                onClick={() => deleteTemplate(t)}
                disabled={deletingId === t.id}
                style={{ fontSize: 12, color: "#f87171" }}
              >
                {deletingId === t.id ? <Spinner size={11} /> : "Delete"}
              </button>
            </div>
          </div>

          {/* Show active override if present */}
          {t.nextCycleOverride && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: "#172554",
                borderRadius: 6,
                border: "1px solid #1e40af",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#93c5fd" }}>⚡ Next cycle override active: </span>
              <span style={{ color: "#e0f2fe" }}>
                ₹{(t.nextCycleOverride.amountPaise / 100).toFixed(2)}
                {t.nextCycleOverride.note && ` — ${t.nextCycleOverride.note}`}
              </span>
              <button
                onClick={() => clearProrate(t.id)}
                disabled={clearingProrateId === t.id}
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  color: "#f87171",
                  background: "none",
                  border: "none",
                  cursor: clearingProrateId === t.id ? "default" : "pointer",
                }}
              >
                {clearingProrateId === t.id ? <Spinner size={10} /> : "Clear override"}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* ── Testing ── */}
      <div style={{ marginTop: 24, padding: 16, background: "#1a1a1a", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Testing</h2>
        <button onClick={runNow} disabled={runningNow}>
          {runningNow ? <Spinner /> : "Run due recurring expenses now"}
        </button>
        <p style={{ fontSize: 12, color: "#555", margin: "8px 0 0" }}>
          In production this fires automatically via a scheduled job.
        </p>
      </div>

      {/* ── Create template dialog ── */}
      {showCreateModal && (
        <Dialog
          icon="🔁"
          iconColor="#2563eb"
          title="Create template"
          onBackdropClick={closeCreateModal}
          footer={
            <>
              <DialogButton variant="secondary" onClick={closeCreateModal} disabled={creatingTemplate}>
                Cancel
              </DialogButton>
              <DialogButton onClick={createTemplate} disabled={!description.trim() || !amount || creatingTemplate}>
                {creatingTemplate ? <Spinner /> : "Create"}
              </DialogButton>
            </>
          }
        >
          <input
            placeholder="Description (e.g. Rent, Mess bill)"
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
          <select value={splitType} onChange={(e) => setSplitType(e.target.value)} style={{ width: "100%" }}>
            <option value="EQUAL">Equal split</option>
            <option value="SHARES">By shares (e.g. meals eaten)</option>
          </select>
          <input
            placeholder="Repeats every N days (30 = monthly)"
            type="number"
            value={frequencyDays}
            onChange={(e) => setFrequencyDays(e.target.value)}
            style={{ width: "100%" }}
          />

          {splitType === "SHARES" && (
            <div>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>
                Enter each person's share units:
              </p>
              {members.map((m) => (
                <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <label style={{ fontSize: 13, flex: 1 }}>{m.user.name || m.user.email}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={shareInputs[m.userId] || ""}
                    onChange={(e) => setShareInputs({ ...shareInputs, [m.userId]: e.target.value })}
                    style={{ width: 80 }}
                  />
                </div>
              ))}
            </div>
          )}
        </Dialog>
      )}

      {/* ── Edit template dialog ── */}
      {editingId && editingTemplate && (
        <Dialog
          icon="✎"
          iconColor="#2563eb"
          title="Edit template"
          onBackdropClick={closeEditModal}
          footer={
            <>
              <DialogButton variant="secondary" onClick={closeEditModal} disabled={savingEdit}>
                Cancel
              </DialogButton>
              <DialogButton onClick={() => saveEdit(editingId)} disabled={savingEdit}>
                {savingEdit ? <Spinner /> : "Save"}
              </DialogButton>
            </>
          }
        >
          <label style={{ fontSize: 12, color: "#888" }}>Description</label>
          <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={{ width: "100%" }} autoFocus />

          <label style={{ fontSize: 12, color: "#888" }}>Amount (₹)</label>
          <input
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            style={{ width: "100%" }}
          />

          <label style={{ fontSize: 12, color: "#888" }}>Frequency (days)</label>
          <input
            type="number"
            value={editFrequency}
            onChange={(e) => setEditFrequency(e.target.value)}
            style={{ width: "100%" }}
          />
        </Dialog>
      )}

      {/* ── Override next cycle (prorate) dialog ── */}
      {proratingId && proratingTemplate && (
        <Dialog
          icon="🔧"
          iconColor="#6b7280"
          title="Override next cycle only"
          onBackdropClick={closeProrateModal}
          footer={
            <>
              <DialogButton variant="secondary" onClick={closeProrateModal} disabled={savingProrate}>
                Cancel
              </DialogButton>
              <DialogButton onClick={() => saveProrate(proratingId)} disabled={savingProrate}>
                {savingProrate ? <Spinner /> : "Save override"}
              </DialogButton>
            </>
          }
        >
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
            This applies once on the next run, then reverts to normal.
          </p>

          <label style={{ fontSize: 12, color: "#888" }}>
            Amount for next cycle (leave blank to keep ₹{(proratingTemplate.amountPaise / 100).toFixed(2)})
          </label>
          <input
            type="number"
            placeholder={`Default: ₹${(proratingTemplate.amountPaise / 100).toFixed(2)}`}
            value={prorateAmount}
            onChange={(e) => setProrateAmount(e.target.value)}
            style={{ width: "100%" }}
            autoFocus
          />

          <label style={{ fontSize: 12, color: "#888" }}>Reason / note</label>
          <input
            placeholder="e.g. Karan joined mid-month, prorated 16/31 days"
            value={prorateNote}
            onChange={(e) => setProrateNote(e.target.value)}
            style={{ width: "100%" }}
          />

          <label style={{ fontSize: 12, color: "#888" }}>
            Exclude from next cycle (e.g. someone who left mid-month):
          </label>
          {members.map((m) => (
            <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={prorateExclude.includes(m.userId)}
                onChange={() => toggleExclude(m.userId)}
                id={`exclude-${m.userId}`}
              />
              <label htmlFor={`exclude-${m.userId}`} style={{ fontSize: 13 }}>
                {m.user.name || m.user.email}
              </label>
            </div>
          ))}
        </Dialog>
      )}
    </div>
  );
}