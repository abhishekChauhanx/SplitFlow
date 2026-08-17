"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

type ContributorInput = { name: string; email: string };

export default function NewKittyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contributors, setContributors] = useState<ContributorInput[]>([{ name: "", email: "" }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function addContributor() {
    setContributors([...contributors, { name: "", email: "" }]);
  }

  function updateContributor(i: number, field: string, value: string) {
    setContributors(contributors.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function removeContributor(i: number) {
    setContributors(contributors.filter((_, idx) => idx !== i));
  }

  async function create() {
    setError("");
    const validContributors = contributors.filter((c) => c.email.trim());
    if (validContributors.length === 0) {
      setError("Add at least one contributor's email");
      return;
    }

    setCreating(true);
    try {
      // Resolve emails to userIds first
      const res = await fetch("/api/kitty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          targetPaise: Math.round(parseFloat(targetAmount) * 100),
          deadline: deadline || null,
          contributorEmails: validContributors.map((c) => c.email.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create kitty");
        return;
      }
      router.push(`/kitty/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
        <BackButton href="/dashboard" />
        <h1 style={{ margin: 0, fontSize: 20 }}>New collection pool</h1>
      </div>
      <p style={{ color: "#888", marginBottom: 20, fontSize: 13 }}>
        Collect money upfront for a gift, event, or shared fund — track contributions and refund the leftover automatically.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Title</label>
        <input placeholder="e.g. Rahul's farewell gift" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Description (optional)</label>
        <input placeholder="e.g. Buying a farewell gift and card" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Target amount (₹)</label>
        <input type="number" placeholder="e.g. 5000" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Deadline (optional)</label>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Contributors</h2>
        <button onClick={addContributor} style={{ fontSize: 13 }}>+ Add</button>
      </div>

      {contributors.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Name" value={c.name} onChange={(e) => updateContributor(i, "name", e.target.value)} style={{ flex: 1 }} />
          <input placeholder="Email" value={c.email} onChange={(e) => updateContributor(i, "email", e.target.value)} style={{ flex: 1 }} />
          {contributors.length > 1 && (
            <button onClick={() => removeContributor(i)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>✕</button>
          )}
        </div>
      ))}

      {targetAmount && contributors.filter((c) => c.email.trim()).length > 0 && (
        <p style={{ fontSize: 12, color: "#666", margin: "8px 0" }}>
          ≈ ₹{(parseFloat(targetAmount) / contributors.filter((c) => c.email.trim()).length).toFixed(0)} per person
        </p>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

      <button
        onClick={create}
        disabled={!title || !targetAmount || creating}
        style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 14, cursor: "pointer", width: "100%", marginTop: 12 }}
      >
        {creating ? "Creating..." : "Create collection pool"}
      </button>
    </div>
  );
}