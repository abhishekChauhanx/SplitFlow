"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";

type SubscriberFormValue = { name: string; email: string };

export default function NewCollectionPage() {
  const router = useRouter();
  const { confirm, promptForm } = useModal();

  const [initialLoading, setInitialLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subscribers, setSubscribers] = useState<SubscriberFormValue[]>([]);
  const [creating, setCreating] = useState(false);
const [businessType, setBusinessType] = useState<string | null>(null);
const [propertyAddress, setPropertyAddress] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 350);
    return () => clearTimeout(t);
  }, []);
useEffect(() => {
  fetch("/api/vendor/register")
    .then((r) => r.json())
    .then((v) => setBusinessType(v?.businessType || null));
}, []);
  async function openSubscriberForm(editingIndex: number | null) {
    const existing = editingIndex !== null ? subscribers[editingIndex] : null;

    const result = await promptForm({
      title: editingIndex !== null ? "Edit subscriber" : "Add subscriber",
      fields: [
        { key: "name", label: "Name", placeholder: "e.g. Rahul Sharma", required: true },
        { key: "email", label: "Email", placeholder: "e.g. rahul@example.com", type: "email", required: true },
      ],
      defaultValues: existing ? { name: existing.name, email: existing.email } : undefined,
      confirmLabel: editingIndex !== null ? "Save" : "Add",
    });

    if (!result) return; // cancelled

    const normalizedEmail = result.email.trim().toLowerCase();
    const dupeIndex = subscribers.findIndex(
      (s, i) => i !== editingIndex && normalizedEmail && s.email.trim().toLowerCase() === normalizedEmail
    );

    if (dupeIndex !== -1) {
      await confirm({
        title: "Duplicate email",
        message: `"${result.email}" is already in this collection's subscriber list.`,
        mode: "alert",
      });
      return;
    }

    const value: SubscriberFormValue = { name: result.name, email: result.email };

    if (editingIndex !== null) {
      setSubscribers(subscribers.map((s, i) => (i === editingIndex ? value : s)));
    } else {
      setSubscribers([...subscribers, value]);
    }
  }

  async function removeSubscriber(i: number) {
    const target = subscribers[i];
    const ok = await confirm({
      title: "Remove subscriber?",
      message: `Remove "${target.name}" (${target.email}) from this collection?`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setSubscribers(subscribers.filter((_, idx) => idx !== i));
  }

  async function create() {
    if (subscribers.length === 0) {
      await confirm({
        title: "No subscribers added",
        message: "Add at least one subscriber before creating this collection.",
        mode: "alert",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/vendor/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  title,
  amountPaise: Math.round(parseFloat(amount) * 100),
  dueDate: dueDate || null,
  propertyAddress: businessType === "landlord" ? propertyAddress.trim() || null : null,
  subscribers,
}),
      });
      const data = await res.json();
      if (!res.ok) {
        await confirm({
          title: "Couldn't create collection",
          message: data.error || "Something went wrong — please try again.",
          mode: "alert",
        });
        return;
      }
      router.push("/vendor/dashboard");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={initialLoading} label="Loading new collection" />
      <SFLoaderOverlay visible={creating} label={`Creating "${title || "collection"}"`} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
        <BackButton href="/vendor/dashboard" />
        <h1 style={{ margin: 0, fontSize: 20 }}>New collection</h1>
      </div>
      <p style={{ color: "#888", marginBottom: 20 }}>
        Create a payment collection cycle for your tenants or subscribers.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>Title</label>
        <input
          placeholder="e.g. August Rent, July Mess Bill"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          Amount per person (₹)
        </label>
        <input
          type="number"
          placeholder="e.g. 3000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          Due date (optional)
        </label>
        {businessType === "landlord" && (
  <div style={{ marginBottom: 20 }}>
    <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
      Property address (required for HRA receipts)
    </label>
    <input
      placeholder="e.g. Flat 4B, Green Valley Apts, Pune"
      value={propertyAddress}
      onChange={(e) => setPropertyAddress(e.target.value)}
      style={{ width: "100%" }}
    />
  </div>
)}
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Subscribers</h2>
        <button
          onClick={() => openSubscriberForm(null)}
          style={{ fontSize: 13, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
        >
          + Add subscriber
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#666", margin: "0 0 12px" }}>
        They'll link to their SplitFlow account automatically the first time they log in and open the collection link with this email.
      </p>

      {subscribers.length === 0 && (
        <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: "#888", margin: 0, fontSize: 13 }}>No subscribers added yet.</p>
        </div>
      )}

      {subscribers.map((s, i) => (
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
            <p style={{ margin: 0, fontSize: 14, color: "#eee" }}>{s.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>{s.email}</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => openSubscriberForm(i)}
              style={{ fontSize: 12, background: "transparent", border: "1px solid #333", borderRadius: 4, color: "#ccc", padding: "4px 10px", cursor: "pointer" }}
            >
              Edit
            </button>
            <button
              onClick={() => removeSubscriber(i)}
              style={{ fontSize: 12, background: "transparent", border: "1px solid #7f1d1d", borderRadius: 4, color: "#f87171", padding: "4px 10px", cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={create}
        disabled={!title || !amount || creating}
        style={{
          background: "#2563eb", color: "#fff", border: "none", borderRadius: 6,
          padding: "10px 20px", fontSize: 14, cursor: "pointer", width: "100%", marginTop: 20,
        }}
      >
        {creating ? "Creating..." : "Create collection"}
      </button>
    </div>
  );
}