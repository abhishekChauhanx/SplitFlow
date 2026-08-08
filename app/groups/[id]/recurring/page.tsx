"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";

export default function RecurringPage() {
  const { id } = useParams();
  const [templates, setTemplates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState("EQUAL");
  const [frequencyDays, setFrequencyDays] = useState("30");
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});

  const loadTemplates = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/recurring`);
    const data = await res.json();
    setTemplates(data);
  }, [id]);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}`);
    const g = await res.json();
    setMembers(g.members);
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTemplates(), loadMembers()]);
  }, [loadTemplates, loadMembers]);

  useEffect(() => {
    loadTemplates();
    loadMembers();
  }, [id, loadTemplates, loadMembers]);

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
      body: JSON.stringify({ description, amountPaise, splitType, shareUnits, frequencyDays: parseInt(frequencyDays) }),
    });
    setDescription("");
    setAmount("");
    loadTemplates();
  }

  async function runNow() {
    const res = await fetch("/api/cron/run-recurring", { method: "POST" });
    const data = await res.json();
    alert(`Generated ${data.generated} expense(s)`);
    loadTemplates();
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <Link href={`/groups/${id}`} style={{ fontSize: 14, color: "#888" }}>
        ← Back to group
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <h1 style={{ margin: 0 }}>Recurring expenses</h1>
        <RefreshButton onRefresh={refreshAll} />
      </div>

      <h2>Create a template</h2>
      <input placeholder="Description (e.g. Rent, Mess bill)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input placeholder="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select value={splitType} onChange={(e) => setSplitType(e.target.value)}>
        <option value="EQUAL">Equal split</option>
        <option value="SHARES">By shares (e.g. meals eaten)</option>
      </select>
      <input placeholder="Repeats every N days (30 = monthly)" type="number" value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} />

      {splitType === "SHARES" && (
        <div>
          <p>Enter each person's share units (e.g. number of meals):</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: </label>
              <input
                type="number"
                value={shareInputs[m.userId] || ""}
                onChange={(e) => setShareInputs({ ...shareInputs, [m.userId]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <button onClick={createTemplate} disabled={!description || !amount}>Create template</button>

      <h2>Active templates</h2>
      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {t.description} — ₹{(t.amountPaise / 100).toFixed(2)} every {t.frequencyDays} days
            ({t.splitType}) — next run: {new Date(t.nextRunAt).toLocaleDateString()}
          </li>
        ))}
      </ul>

      <h2>Testing</h2>
      <button onClick={runNow}>Run due recurring expenses now</button>
      <p style={{ color: "#888", fontSize: 12 }}>
        In production this button doesn't exist — a scheduled job (e.g. Vercel Cron) calls
        /api/cron/run-recurring automatically on a schedule. This button is here so you can
        manually trigger it during development instead of waiting for real time to pass.
      </p>
    </div>
  );
}