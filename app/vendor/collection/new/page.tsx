"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";

type SubscriberFormValue = { name: string; email: string; phone: string };

export default function NewCollectionPage() {
  const router = useRouter();
  const { confirm, promptForm } = useModal();

  const [initialLoading, setInitialLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subscribers, setSubscribers] = useState<SubscriberFormValue[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  async function openSubscriberForm(editingIndex: number | null) {
    const existing = editingIndex !== null ? subscribers[editingIndex] : null;

    const result = await promptForm({
      title: editingIndex !== null ? "Edit subscriber" : "Add subscriber",
      fields: [
        { key: "name", label: "Name", placeholder: "e.g. Rahul Sharma", required: true },
        { key: "email", label: "Email", placeholder: "e.g. rahul@example.com", type: "email" },
        { key: "phone", label: "Phone", placeholder: "e.g. 98765 43210", type: "tel" },
      ],
      defaultValues: existing ? { name: existing.name, email: existing.email, phone: existing.phone } : undefined,
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

    const value: SubscriberFormValue = { name: result.name, email: result.email, phone: result.phone };

    if (editingIndex !== null) {
      setSubscribers(subscribers.map((s, i) => (i === editingIndex ? value : s)));
    } else {
      setSubscribers([...subscribers, value]);
    }
  }

  function removeSubscriber(i: number) {
    setSubscribers(subscribers.filter((_, idx) => idx !== i));
  }

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/vendor/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amountPaise: Math.round(parseFloat(amount) * 100),
          dueDate: dueDate || null,
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

      {subscribers.length === 0 && (
        <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: "#888", margin: 0, fontSize: 13 }}>No subscribers added yet.</p>
        </div>
      )}

      {subscribers.map((s, i) => (
        <div
          key={i}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 12px", background: "#141414", border: "1px solid #2a2a2a",
            borderRadius: 8, marginBottom: 8,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 14 }}>{s.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>
              {[s.email, s.phone].filter(Boolean).join(" · ") || "No contact info"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => openSubscriberForm(i)} style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>
              Edit
            </button>
            <button onClick={() => removeSubscriber(i)} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
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