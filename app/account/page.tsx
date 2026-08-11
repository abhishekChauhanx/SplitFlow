"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUpiId, setEditUpiId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  function loadProfile() {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setEditName(data.name || "");
        setEditPhone(data.phone || "");
        setEditUpiId(data.upiId || "");
        setLoading(false);
      });
  }

  useEffect(() => { loadProfile(); }, []);

  async function saveProfile() {
    setSaving(true);
    setSaveSuccess(false);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, phone: editPhone, upiId: editUpiId }),
    });
    setSaving(false);
    setSaveSuccess(true);
    setEditing(false);
    loadProfile();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/user/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `splitflow-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Couldn't delete account");
        setDeleting(false);
        return;
      }
      router.push("/account-deleted");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return (
    <p style={{ textAlign: "center", marginTop: 80 }}>Loading...</p>
  );

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <Link href="/dashboard" style={{ fontSize: 13, color: "#888" }}>
        ← Back to dashboard
      </Link>
      <h1 style={{ marginTop: 8 }}>Account settings</h1>

      {/* ── Profile section ── */}
      <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>My profile</h2>
          {!editing && (
            <button onClick={() => { setEditing(true); setSaveSuccess(false); }} style={{ fontSize: 13 }}>
              Edit
            </button>
          )}
        </div>

        {!editing ? (
          // View mode
          <div>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <span style={{ color: "#888", marginRight: 8 }}>Name</span>
              {user?.name || "—"}
            </p>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <span style={{ color: "#888", marginRight: 8 }}>Email</span>
              {user?.email || "—"}
            </p>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <span style={{ color: "#888", marginRight: 8 }}>Phone</span>
              {user?.phone || "—"}
            </p>
            <p style={{ margin: "4px 0", fontSize: 14 }}>
              <span style={{ color: "#888", marginRight: 8 }}>UPI ID</span>
              {user?.upiId || "—"}
            </p>
            {saveSuccess && (
              <p style={{ color: "#86efac", fontSize: 13, marginTop: 8 }}>
                ✓ Profile updated successfully
              </p>
            )}
          </div>
        ) : (
          // Edit mode — inline, no redirect
          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
                Full name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
                Phone number
              </label>
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
                UPI ID
              </label>
              <input
                value={editUpiId}
                onChange={(e) => setEditUpiId(e.target.value)}
                placeholder="e.g. name@okhdfcbank"
                style={{ width: "100%" }}
              />
            </div>
            <p style={{ fontSize: 12, color: "#555", margin: "0 0 10px" }}>
              Email address cannot be changed — it's used to log in.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={saveProfile}
                disabled={saving || !editName}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ color: "#888" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Data export ── */}
      <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Export my data</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#888", lineHeight: 1.5 }}>
          Download everything SplitFlow holds about you as a JSON file. Your right under the DPDP Act 2023.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {exporting ? "Preparing download..." : "⬇ Download my data"}
        </button>
      </div>

      {/* ── Account deletion ── */}
      <div style={{
        padding: 16,
        background: "#1a1a1a",
        border: "1px solid #7f1d1d",
        borderRadius: 8,
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#f87171" }}>
          Delete my account
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#888", lineHeight: 1.5 }}>
          Permanently removes your name, email, phone, and UPI ID. Expense records stay visible to group members as "Deleted User" to preserve their financial history.
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>
          <strong>This cannot be undone.</strong>
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              background: "transparent",
              color: "#f87171",
              border: "1px solid #7f1d1d",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Delete my account
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              placeholder="Type DELETE here"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              style={{ width: "100%", marginBottom: 10, fontFamily: "monospace", letterSpacing: 2 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== "DELETE" || deleting}
                style={{
                  background: deleteInput === "DELETE" ? "#dc2626" : "#374151",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: deleteInput === "DELETE" ? "pointer" : "not-allowed",
                  fontSize: 13,
                }}
              >
                {deleting ? "Deleting..." : "Permanently delete"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                style={{
                  background: "transparent",
                  color: "#888",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}