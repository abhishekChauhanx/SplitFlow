"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";

type ContributorInput = { name: string; email: string };

export default function NewKittyPage() {
  const router = useRouter();
  const { confirm, promptForm } = useModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [collectorUpiId, setCollectorUpiId] = useState("");
  const [contributors, setContributors] = useState<ContributorInput[]>([]);
  const [creating, setCreating] = useState(false);

  async function openContributorForm(editingIndex: number | null) {
    const existing = editingIndex !== null ? contributors[editingIndex] : null;

    const result = await promptForm({
      title: editingIndex !== null ? "Edit contributor" : "Add contributor",
      fields: [
        { key: "name", label: "Name", placeholder: "e.g. Rahul Sharma", required: true },
        { key: "email", label: "Email", placeholder: "e.g. rahul@example.com", type: "email", required: true },
      ],
      defaultValues: existing ? { name: existing.name, email: existing.email } : undefined,
      confirmLabel: editingIndex !== null ? "Save" : "Add",
    });

    if (!result) return; // cancelled

    const normalizedEmail = result.email.trim().toLowerCase();
    const dupeIndex = contributors.findIndex(
      (c, i) => i !== editingIndex && normalizedEmail && c.email.trim().toLowerCase() === normalizedEmail
    );
    if (dupeIndex !== -1) {
      await confirm({
        title: "Duplicate email",
        message: `"${result.email}" is already in this collection's contributor list.`,
        mode: "alert",
      });
      return;
    }

    const value: ContributorInput = { name: result.name, email: result.email };

    if (editingIndex !== null) {
      setContributors(contributors.map((c, i) => (i === editingIndex ? value : c)));
    } else {
      setContributors([...contributors, value]);
    }
  }

  async function removeContributor(i: number) {
    const target = contributors[i];
    const ok = await confirm({
      title: "Remove contributor?",
      message: `Remove "${target.name}" (${target.email}) from this collection?`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setContributors(contributors.filter((_, idx) => idx !== i));
  }

  async function create() {
    if (!title.trim()) {
      await confirm({ title: "Title required", message: "Please enter a title for this collection.", mode: "alert" });
      return;
    }
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      await confirm({ title: "Target amount required", message: "Please enter a target amount.", mode: "alert" });
      return;
    }
    if (contributors.length === 0) {
      await confirm({ title: "Add contributors", message: "Add at least one contributor.", mode: "alert" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/kitty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          targetPaise: Math.round(parseFloat(targetAmount) * 100),
          deadline: deadline || null,
          collectorUpiId: collectorUpiId.trim() || null,
          contributorEmails: contributors.map((c) => c.email.trim()),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Turn the loader off BEFORE opening the dialog — this is Fix 2
        setCreating(false);
        await confirm({ title: "Couldn't create collection", message: data.error, mode: "alert" });
        return;
      }

      router.push(`/kitty/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={creating} label="Creating collection pool" />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
        <BackButton href="/kitty" />
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

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Deadline (optional)</label>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          Your UPI ID (where contributions get paid)
        </label>
        <input
          placeholder="e.g. yourname@okhdfcbank"
          value={collectorUpiId}
          onChange={(e) => setCollectorUpiId(e.target.value)}
          style={{ width: "100%" }}
        />
        <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>
          Contributors will see a QR code to pay directly to this UPI ID.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Contributors</h2>
        <button
          onClick={() => openContributorForm(null)}
          style={{ fontSize: 13, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
        >
          + Add contributor
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#666", margin: "0 0 12px" }}>
        Contributors need an existing SplitFlow account — ask them to sign up first if they don't have one.
      </p>

      {contributors.length === 0 && (
        <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: "#888", margin: 0, fontSize: 13 }}>No contributors added yet.</p>
        </div>
      )}

      {contributors.map((c, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            background: "#1a1a1a",
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 14, color: "#eee" }}>{c.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>{c.email}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => openContributorForm(i)}
              style={{ fontSize: 12, background: "transparent", border: "1px solid #333", borderRadius: 4, color: "#ccc", padding: "4px 10px", cursor: "pointer" }}
            >
              Edit
            </button>
            <button
              onClick={() => removeContributor(i)}
              style={{ fontSize: 12, background: "transparent", border: "1px solid #7f1d1d", borderRadius: 4, color: "#f87171", padding: "4px 10px", cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {targetAmount && contributors.length > 0 && (
        <p style={{ fontSize: 12, color: "#666", margin: "8px 0" }}>
          ≈ ₹{(parseFloat(targetAmount) / contributors.length).toFixed(0)} per person
        </p>
      )}

      <button
        onClick={create}
        disabled={creating}
        style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 14, cursor: "pointer", width: "100%", marginTop: 20 }}
      >
        {creating ? "Creating..." : "Create collection pool"}
      </button>
    </div>
  );
}