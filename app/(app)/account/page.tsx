"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppShell } from "@/components/app-shell/AppShellContext";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import Spinner from "@/components/Spinner";
import "../../home.css";
import "./account.css";
import "../groups/[id]/group.css";

function Dialog({
  icon,
  tone,
  title,
  onBackdropClick,
  children,
  footer,
}: {
  icon: string;
  tone: "edit" | "delete";
  title: string;
  onBackdropClick: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="acct-dialog-backdrop" onClick={onBackdropClick}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="group-dialog acct-dialog-box"
      >
        <div className="group-dialog-header">
          <div className={`group-dialog-icon acct-dialog-icon--${tone}`}>
            {icon}
          </div>
          <span className="group-dialog-title">{title}</span>
        </div>
        <div className="group-dialog-body">{children}</div>
        <div className="group-dialog-footer">{footer}</div>
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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group-dialog-btn ${variant}`}
    >
      {children}
    </button>
  );
}

function scoreColor(score: number) {
  if (score >= 90) return "emerald";
  if (score >= 75) return "lime";
  if (score >= 55) return "amber";
  return "orange";
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className={`acct-score-ring acct-score-ring--${scoreColor(score)}`}>
      <span className="acct-score-value">{score}</span>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { registerInfoHandler } = useAppShell();

  const [user, setUser]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [editName, setEditName]   = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUpiId, setEditUpiId] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [trustScore, setTrustScore]   = useState<any>(null);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadProfile = useCallback(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setEditName(data.name || "");
        setEditPhone(data.phone || "");
        setEditUpiId(data.upiId || "");
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    fetch("/api/user/trust-score")
      .then((r) => r.json())
      .then(setTrustScore);
  }, []);

  useEffect(() => {
    registerInfoHandler(null);
    return () => registerInfoHandler(null);
  }, [registerInfoHandler]);

  async function saveProfile() {
    setSaving(true);
    setSaveSuccess(false);
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        phone: editPhone,
        upiId: editUpiId,
      }),
    });
    setSaving(false);
    setSaveSuccess(true);
    setShowEditModal(false);
    loadProfile();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res  = await fetch("/api/user/export");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
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

  return (
    <div className="dash-page">
      <div className="hero-glow" />
      <div className="hero-grid" />

      <SFLoaderOverlay visible={loading} label="Loading your account" />

      <div className="dash-container">

        {/* ── Header — always in DOM so it never jumps ── */}
        <div className="acct-page-header">
          {/* <Link href="/dashboard" className="acct-breadcrumb">
             Dashboard
          </Link> */}
          <div className="acct-title-row">
            <h1 className="text-gradient acct-page-title">Account </h1>
            <RefreshButton onRefresh={loadProfile} label="Refreshing account" />
          </div>
        </div>

        {!loading && (
          <div className="acct-grid">

            {/* ── Profile ── */}
            <section className="acct-card">
              <div className="acct-card-header">
                <div>
                  <p className="acct-card-title">Profile</p>
                  <p className="acct-card-sub">Your name, phone, and UPI ID</p>
                </div>
                <button
                  className="group-action-btn"
                  onClick={() => { setShowEditModal(true); setSaveSuccess(false); }}
                >
                  Edit
                </button>
              </div>

              <div className="acct-fields">
                {[
                  { label: "Name",   value: user?.name },
                  { label: "Email",  value: user?.email },
                  { label: "Phone",  value: user?.phone },
                  { label: "UPI ID", value: user?.upiId },
                ].map(({ label, value }) => (
                  <div key={label} className="acct-field-row">
                    <span className="acct-field-label">{label}</span>
                    <span className="acct-field-value">{value || "—"}</span>
                  </div>
                ))}
                {saveSuccess && (
                  <p className="acct-success-msg">✓ Profile updated</p>
                )}
              </div>
            </section>

            {/* ── Trust score ── */}
            {trustScore && (
              <section className="acct-card">
                <div className="acct-card-header">
                  <div>
                    <p className="acct-card-title">Trust score</p>
                    <p className="acct-card-sub">Based on your settlement history</p>
                  </div>
                </div>

                <div className="acct-trust-hero">
                  <ScoreRing score={trustScore.score} />
                  <div>
                    <p className="acct-trust-label">{trustScore.label}</p>
                    <p className="acct-trust-meta">
                      {trustScore.totalSettlements} settlement{trustScore.totalSettlements === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="acct-trust-stats">
                  {[
                    { label: "On-time confirmations", value: `${Math.round(trustScore.onTimeRate * 100)}%` },
                    { label: "Dispute-free rate",     value: `${Math.round((1 - trustScore.disputeRate) * 100)}%` },
                    { label: "UTR proof provided",    value: `${Math.round(trustScore.utrSubmissionRate * 100)}%` },
                    { label: "Settlements completed", value: `${Math.round(trustScore.completionRate * 100)}%` },
                  ].map((stat) => (
                    <div key={stat.label} className="acct-trust-stat">
                      <p className="acct-trust-stat-label">{stat.label}</p>
                      <p className="acct-trust-stat-value">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Export data ── */}
            <section className="acct-card">
              <div className="acct-card-header">
                <div>
                  <p className="acct-card-title">Export data</p>
                  <p className="acct-card-sub">Your right under the DPDP Act 2023</p>
                </div>
              </div>
              <p className="acct-card-desc">
                Download everything SplitFlow holds about you as a JSON file.
              </p>
              <button
                className="group-action-btn acct-export-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? <Spinner /> : "↓ Download my data"}
              </button>
            </section>

            {/* ── Delete account ── */}
            <section className="acct-card acct-card--danger">
              <div className="acct-card-header">
                <div>
                  <p className="acct-card-title acct-danger-title">Delete account</p>
                  <p className="acct-card-sub">This cannot be undone</p>
                </div>
              </div>
              <p className="acct-card-desc">
                Removes your name, email, phone, and UPI ID permanently. Expense records
                stay visible to group members as "Deleted user" to preserve their history.
              </p>
              <button
                className="acct-danger-btn"
                onClick={() => { setShowDeleteModal(true); setDeleteInput(""); }}
              >
                Delete my account
              </button>
            </section>

          </div>
        )}

        {/* ── Edit profile dialog ── */}
        {showEditModal && (
          <Dialog
            icon="✎"
            tone="edit"
            title="Edit profile"
            onBackdropClick={() => { if (!saving) setShowEditModal(false); }}
            footer={
              <>
                <DialogButton
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancel
                </DialogButton>
                <DialogButton
                  onClick={saveProfile}
                  disabled={saving || !editName}
                >
                  {saving ? <Spinner /> : "Save changes"}
                </DialogButton>
              </>
            }
          >
            <label className="acct-dialog-label">Full name</label>
            <input
              className="acct-dialog-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
              autoFocus
            />
            <label className="acct-dialog-label">Phone number</label>
            <input
              className="acct-dialog-input"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
            <label className="acct-dialog-label">UPI ID</label>
            <input
              className="acct-dialog-input"
              value={editUpiId}
              onChange={(e) => setEditUpiId(e.target.value)}
              placeholder="name@okhdfcbank"
            />
            <p className="acct-dialog-note">
              Email can't be changed — it's used to sign in.
            </p>
          </Dialog>
        )}

        {/* ── Delete account dialog ── */}
        {showDeleteModal && (
          <Dialog
            icon="⚠"
            tone="delete"
            title="Delete account"
            onBackdropClick={() => {
              if (!deleting) { setShowDeleteModal(false); setDeleteInput(""); }
            }}
            footer={
              <>
                <DialogButton
                  variant="secondary"
                  onClick={() => { setShowDeleteModal(false); setDeleteInput(""); }}
                  disabled={deleting}
                >
                  Cancel
                </DialogButton>
                <DialogButton
                  onClick={handleDelete}
                  disabled={deleteInput !== "DELETE" || deleting}
                >
                  {deleting ? <Spinner /> : "Permanently delete"}
                </DialogButton>
              </>
            }
          >
            <p className="acct-dialog-warning">
              Removes your name, email, phone, and UPI ID permanently. Expense
              records stay visible to group members as "Deleted user".
            </p>
            <p className="acct-dialog-warning--strong">
              This cannot be undone.
            </p>
            <label className="acct-dialog-label">
              Type <strong className="acct-dialog-delete-word">DELETE</strong> to confirm:
            </label>
            <input
              type="text"
              className="acct-dialog-input acct-dialog-input--mono"
              placeholder="DELETE"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              autoFocus
            />
          </Dialog>
        )}

      </div>
    </div>
  );
}