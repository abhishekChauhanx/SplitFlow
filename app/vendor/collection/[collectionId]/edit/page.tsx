"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";

export default function EditCollectionPage() {
  const { collectionId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  // existing subscribers, tracked with edit + removal state
  const [existing, setExisting] = useState<any[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<{ name: string; email: string; phone: string }[]>([]);

  async function load() {
    const res = await fetch(`/api/vendor/collections/${collectionId}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to load"); setLoading(false); return; }
    setTitle(data.title);
    setAmount((data.amountPaise / 100).toString());
    setDueDate(data.dueDate ? data.dueDate.slice(0, 10) : "");
    setExisting(data.subscribers.map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email || "",
      phone: s.phone || "",
      hasPaid: !!s.payment,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [collectionId]);

  function updateExisting(id: string, field: string, value: string) {
    setExisting(existing.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function toggleRemove(id: string) {
    setRemovedIds(removedIds.includes(id) ? removedIds.filter((x) => x !== id) : [...removedIds, id]);
  }

  function addRow() {
    setAdded([...added, { name: "", email: "", phone: "" }]);
  }

  function updateAdded(i: number, field: string, value: string) {
    setAdded(added.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function removeAddedRow(i: number) {
    setAdded(added.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/vendor/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amountPaise: Math.round(parseFloat(amount) * 100),
          dueDate: dueDate || null,
          updateSubscribers: existing
            .filter((s) => !removedIds.includes(s.id))
            .map((s) => ({ id: s.id, name: s.name, email: s.email || null, phone: s.phone || null })),
          removeSubscriberIds: removedIds,
          addSubscribers: added.filter((s) => s.name.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      router.push("/vendor/dashboard");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={saving} label="Saving..." />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <BackButton href="/vendor/dashboard" />
          <h1 style={{ margin: 0, fontSize: 20 }}>Edit collection</h1>
        </div>
        <RefreshButton onRefresh={load} label="Refreshing..." />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Amount per person (₹)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Due date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%" }} />
      </div>

      <h2 style={{ fontSize: 15 }}>Existing subscribers</h2>
      {existing.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            alignItems: "center",
            opacity: removedIds.includes(s.id) ? 0.4 : 1,
          }}
        >
          <input
            placeholder="Name"
            value={s.name}
            disabled={removedIds.includes(s.id)}
            onChange={(e) => updateExisting(s.id, "name", e.target.value)}
            style={{ flex: 2 }}
          />
          <input
            placeholder="Email"
            value={s.email}
            disabled={removedIds.includes(s.id)}
            onChange={(e) => updateExisting(s.id, "email", e.target.value)}
            style={{ flex: 2 }}
          />
          <input
            placeholder="Phone"
            value={s.phone}
            disabled={removedIds.includes(s.id)}
            onChange={(e) => updateExisting(s.id, "phone", e.target.value)}
            style={{ flex: 2 }}
          />
          <button
            onClick={() => toggleRemove(s.id)}
            disabled={s.hasPaid}
            title={s.hasPaid ? "Can't remove — already paid" : removedIds.includes(s.id) ? "Undo remove" : "Remove"}
            style={{
              color: s.hasPaid ? "#555" : "#f87171",
              background: "none",
              border: "none",
              cursor: s.hasPaid ? "not-allowed" : "pointer",
              fontSize: 16,
            }}
          >
            {removedIds.includes(s.id) ? "↺" : "✕"}
          </button>
        </div>
      ))}

      <h2 style={{ fontSize: 15, marginTop: 20 }}>Add new subscribers</h2>
      {added.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="Name *" value={s.name} onChange={(e) => updateAdded(i, "name", e.target.value)} style={{ flex: 2 }} />
          <input placeholder="Email" value={s.email} onChange={(e) => updateAdded(i, "email", e.target.value)} style={{ flex: 2 }} />
          <input placeholder="Phone" value={s.phone} onChange={(e) => updateAdded(i, "phone", e.target.value)} style={{ flex: 2 }} />
          <button onClick={() => removeAddedRow(i)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      ))}
      <button
        onClick={addRow}
        style={{ fontSize: 13, color: "#888", background: "none", border: "1px dashed #333", borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginBottom: 20, width: "100%" }}
      >
        + Add another subscriber
      </button>

      {error && <p style={{ color: "#f87171", marginBottom: 12 }}>{error}</p>}

      <button
        onClick={save}
        disabled={saving || !title || !amount}
        style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 14, cursor: "pointer", width: "100%" }}
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}