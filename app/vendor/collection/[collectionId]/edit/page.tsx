"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";

type ExistingSubscriber = {
  id: string;
  name: string;
  email: string;
  phone: string;
  hasPaid: boolean;
};

type NewSubscriber = { name: string; email: string; phone: string };

export default function EditCollectionPage() {
  const { collectionId } = useParams();
  const router = useRouter();
  const { confirm, promptForm } = useModal();

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [existing, setExisting] = useState<ExistingSubscriber[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<NewSubscriber[]>([]);

  async function load() {
    const res = await fetch(`/api/vendor/collections/${collectionId}`);
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.error || "Failed to load collection");
      return;
    }
    setLoadError("");
    setTitle(data.title);
    setAmount((data.amountPaise / 100).toString());
    setDueDate(data.dueDate ? data.dueDate.slice(0, 10) : "");
    setExisting(
      data.subscribers.map((s: any) => ({
        id: s.id,
        name: s.name,
        email: s.email || "",
        phone: s.phone || "",
        hasPaid: !!s.payment,
      }))
    );
    setRemovedIds([]);
    setAdded([]);
  }

  useEffect(() => {
    load().finally(() => setInitialLoading(false));
  }, [collectionId]);

  function updateExisting(id: string, field: string, value: string) {
    setExisting(existing.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function toggleRemove(id: string) {
    setRemovedIds(removedIds.includes(id) ? removedIds.filter((x) => x !== id) : [...removedIds, id]);
  }

  function allEmailsExcept(excludeId?: string, excludeAddedIndex?: number) {
    const fromExisting = existing
      .filter((s) => s.id !== excludeId && !removedIds.includes(s.id))
      .map((s) => s.email.trim().toLowerCase())
      .filter(Boolean);
    const fromAdded = added
      .filter((_, i) => i !== excludeAddedIndex)
      .map((s) => s.email.trim().toLowerCase())
      .filter(Boolean);
    return [...fromExisting, ...fromAdded];
  }

  async function openAddSubscriberForm() {
    const result = await promptForm({
      title: "Add subscriber",
      fields: [
        { key: "name", label: "Name", placeholder: "e.g. Rahul Sharma", required: true },
        { key: "email", label: "Email", placeholder: "e.g. rahul@example.com", type: "email" },
        { key: "phone", label: "Phone", placeholder: "e.g. 98765 43210", type: "tel" },
      ],
      confirmLabel: "Add",
    });

    if (!result) return;

    const normalizedEmail = result.email.trim().toLowerCase();
    if (normalizedEmail && allEmailsExcept().includes(normalizedEmail)) {
      await confirm({
        title: "Duplicate email",
        message: `"${result.email}" is already in this collection's subscriber list.`,
        mode: "alert",
      });
      return;
    }

    setAdded([...added, { name: result.name, email: result.email, phone: result.phone }]);
  }

  async function openEditAddedForm(index: number) {
    const current = added[index];
    const result = await promptForm({
      title: "Edit subscriber",
      fields: [
        { key: "name", label: "Name", placeholder: "e.g. Rahul Sharma", required: true },
        { key: "email", label: "Email", placeholder: "e.g. rahul@example.com", type: "email" },
        { key: "phone", label: "Phone", placeholder: "e.g. 98765 43210", type: "tel" },
      ],
      defaultValues: current,
      confirmLabel: "Save",
    });

    if (!result) return;

    const normalizedEmail = result.email.trim().toLowerCase();
    if (normalizedEmail && allEmailsExcept(undefined, index).includes(normalizedEmail)) {
      await confirm({
        title: "Duplicate email",
        message: `"${result.email}" is already in this collection's subscriber list.`,
        mode: "alert",
      });
      return;
    }

    setAdded(added.map((s, i) => (i === index ? { name: result.name, email: result.email, phone: result.phone } : s)));
  }

  function removeAddedRow(i: number) {
    setAdded(added.filter((_, idx) => idx !== i));
  }

  async function save() {
    // client-side duplicate check across everything about to be sent
    const finalEmails = [
      ...existing.filter((s) => !removedIds.includes(s.id)).map((s) => s.email.trim().toLowerCase()),
      ...added.map((s) => s.email.trim().toLowerCase()),
    ].filter(Boolean);
    const dupe = finalEmails.find((e, i) => finalEmails.indexOf(e) !== i);
    if (dupe) {
      await confirm({
        title: "Duplicate email",
        message: `"${dupe}" appears more than once in the subscriber list.`,
        mode: "alert",
      });
      return;
    }

    setSaving(true);
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
      if (!res.ok) {
        await confirm({
          title: "Couldn't save changes",
          message: data.error || "Something went wrong — please try again.",
          mode: "alert",
        });
        return;
      }
      router.push("/vendor/dashboard");
    } finally {
      setSaving(false);
    }
  }

  const overlayVisible = initialLoading || saving;
  const overlayLabel = saving ? `Saving "${title || "collection"}"` : "Loading collection";

  if (initialLoading) {
    return <SFLoaderOverlay visible={true} label={overlayLabel} />;
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
          <BackButton href="/vendor/dashboard" />
          <h1 style={{ margin: 0, fontSize: 20 }}>Edit collection</h1>
        </div>
        <p style={{ color: "#f87171" }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={overlayVisible} label={overlayLabel} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <BackButton href="/vendor/dashboard" />
          <h1 style={{ margin: 0, fontSize: 20 }}>Edit collection</h1>
        </div>
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>New subscribers</h2>
        <button
          onClick={openAddSubscriberForm}
          style={{ fontSize: 13, background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
        >
          + Add subscriber
        </button>
      </div>

      {added.length === 0 && (
        <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: "#888", margin: 0, fontSize: 13 }}>No new subscribers added.</p>
        </div>
      )}

      {added.map((s, i) => (
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
            <button onClick={() => openEditAddedForm(i)} style={{ fontSize: 12, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>
              Edit
            </button>
            <button onClick={() => removeAddedRow(i)} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
              Remove
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving || !title || !amount}
        style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px", fontSize: 14, cursor: "pointer", width: "100%", marginTop: 20 }}
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}