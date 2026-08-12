"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function RecurringPage() {
  const { id } = useParams();
  const [templates, setTemplates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState("EQUAL");
  const [frequencyDays, setFrequencyDays] = useState("30");
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editFrequency, setEditFrequency] = useState("");

  // Prorate state
  const [proratingId, setProratingId] = useState<string | null>(null);
  const [prorateAmount, setProrateAmount] = useState("");
  const [prorateNote, setProrateNote] = useState("");
  const [prorateExclude, setProrateExclude] = useState<string[]>([]);

  function load() {
    fetch(`/api/groups/${id}/recurring`)
      .then((r) => r.json())
      .then(setTemplates);
  }

  useEffect(() => {
    load();
    fetch(`/api/groups/${id}`)
      .then((r) => r.json())
      .then((g) => { if (g?.members) setMembers(g.members); });
  }, [id]);

  async function createTemplate() {
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
    load();
  }

  async function runNow() {
    const res = await fetch("/api/cron/run-recurring", { method: "POST" });
    const data = await res.json();
    alert(`Generated ${data.generated} expense(s)`);
    load();
  }

  async function togglePause(templateId: string) {
    const res = await fetch(
      `/api/groups/${id}/recurring/${templateId}/pause`,
      { method: "POST" }
    );
    const data = await res.json();
    alert(data.message);
    load();
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm("Delete this recurring template? This won't delete past expenses.")) return;
    await fetch(`/api/groups/${id}/recurring/${templateId}`, { method: "DELETE" });
    load();
  }

  async function saveEdit(templateId: string) {
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
    load();
  }

  async function saveProrate(templateId: string) {
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
    load();
    alert("Next cycle override saved. It will apply on the next run, then revert to normal.");
  }

  async function clearProrate(templateId: string) {
    await fetch(`/api/groups/${id}/recurring/${templateId}/prorate`, {
      method: "DELETE",
    });
    load();
  }

  function toggleExclude(userId: string) {
    setProrateExclude((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <Link href={`/groups/${id}`} style={{ fontSize: 13, color: "#888" }}>
        ← Back to group
      </Link>
      <h1>Recurring expenses</h1>

      {/* ── Create template ── */}
      <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Create a template</h2>
        <input
          placeholder="Description (e.g. Rent, Mess bill)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <input
          placeholder="Amount (₹)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <select
          value={splitType}
          onChange={(e) => setSplitType(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        >
          <option value="EQUAL">Equal split</option>
          <option value="SHARES">By shares (e.g. meals eaten)</option>
        </select>
        <input
          placeholder="Repeats every N days (30 = monthly)"
          type="number"
          value={frequencyDays}
          onChange={(e) => setFrequencyDays(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />

        {splitType === "SHARES" && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>
              Enter each person's share units:
            </p>
            {members.map((m) => (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <label style={{ fontSize: 13, flex: 1 }}>
                  {m.user.name || m.user.email}
                </label>
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

        <button onClick={createTemplate} disabled={!description || !amount}>
          Create template
        </button>
      </div>

      {/* ── Active templates ── */}
      <h2>Templates</h2>
      {templates.length === 0 && (
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
          {editingId === t.id ? (
            // ── Edit form ──
            <div>
              <h3 style={{ margin: "0 0 10px" }}>Edit template</h3>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Description
                </label>
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Frequency (days)
                </label>
                <input
                  type="number"
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => saveEdit(t.id)}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ color: "#888" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : proratingId === t.id ? (
            // ── Prorate form ──
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Override next cycle only</h3>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px" }}>
                This applies once on the next run, then reverts to normal.
              </p>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Amount for next cycle (leave blank to keep ₹{(t.amountPaise / 100).toFixed(2)})
                </label>
                <input
                  type="number"
                  placeholder={`Default: ₹${(t.amountPaise / 100).toFixed(2)}`}
                  value={prorateAmount}
                  onChange={(e) => setProrateAmount(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Reason / note
                </label>
                <input
                  placeholder="e.g. Karan joined mid-month, prorated 16/31 days"
                  value={prorateNote}
                  onChange={(e) => setProrateNote(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>
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
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => saveProrate(t.id)}>Save override</button>
                <button onClick={() => setProratingId(null)} style={{ color: "#888" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // ── Normal view ──
            <div>
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
                  <button
                    onClick={() => {
                      setEditingId(t.id);
                      setEditDesc(t.description);
                      setEditAmount((t.amountPaise / 100).toString());
                      setEditFrequency(t.frequencyDays.toString());
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => togglePause(t.id)}
                    style={{ fontSize: 12, color: t.active ? "#f59e0b" : "#86efac" }}
                  >
                    {t.active ? "⏸ Pause" : "▶ Resume"}
                  </button>
                  <button
                    onClick={() => {
                      setProratingId(t.id);
                      setProrateAmount("");
                      setProrateNote("");
                      setProrateExclude([]);
                    }}
                    style={{ fontSize: 12, color: "#93c5fd" }}
                  >
                    🔧 Override next cycle
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    style={{ fontSize: 12, color: "#f87171" }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Show active override if present */}
              {t.nextCycleOverride && (
                <div style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "#172554",
                  borderRadius: 6,
                  border: "1px solid #1e40af",
                  fontSize: 13,
                }}>
                  <span style={{ color: "#93c5fd" }}>⚡ Next cycle override active: </span>
                  <span style={{ color: "#e0f2fe" }}>
                    ₹{(t.nextCycleOverride.amountPaise / 100).toFixed(2)}
                    {t.nextCycleOverride.note && ` — ${t.nextCycleOverride.note}`}
                  </span>
                  <button
                    onClick={() => clearProrate(t.id)}
                    style={{ marginLeft: 10, fontSize: 11, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear override
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* ── Testing ── */}
      <div style={{ marginTop: 24, padding: 16, background: "#1a1a1a", borderRadius: 8 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Testing</h2>
        <button onClick={runNow}>Run due recurring expenses now</button>
        <p style={{ fontSize: 12, color: "#555", margin: "8px 0 0" }}>
          In production this fires automatically via a scheduled job.
        </p>
      </div>
    </div>
  );
}