"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";
import TableOverlay from "@/components/TableOverlay";
import GroupsSummaryGrid from "@/components/GroupsSummaryGrid";
import type { GroupSummaryRow } from "@/lib/dashboard-summary";
import PushNotificationButton from "@/components/PushNotificationButton";
import "../home.css";
import "./dashboard.css";

export default function DashboardPage() {
  const router = useRouter();
  const { confirm } = useModal();
  const [groups, setGroups] = useState<any[]>([]);
  const [summaryRows, setSummaryRows] = useState<GroupSummaryRow[]>([]);
  const [me, setMe] = useState<{ name?: string; email?: string } | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data);
  }, []);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/dashboard/groups-summary");
    if (res.ok) setSummaryRows(await res.json());
  }, []);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) setMe(await res.json());
  }, []);

  const loadPendingRequests = useCallback(() => {
    return fetch(`/api/edit-permissions/pending`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setPendingRequests(data))
      .catch(() => {});
  }, []);

  const respondToRequest = useCallback(
    async (permissionId: string, decision: "approved" | "denied") => {
      await fetch(`/api/edit-permissions/${permissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      loadPendingRequests();
    },
    [loadPendingRequests]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([loadGroups(), loadSummary(), loadMe(), loadPendingRequests()]);
  }, [loadGroups, loadSummary, loadMe, loadPendingRequests]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        loadPendingRequests();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshAll, loadPendingRequests]);

  async function createGroup() {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;

    const duplicate = groups.find(
      (g) => g.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      await confirm({
        title: "Group already exists",
        message: `"${trimmedName}" group already exists — please try a different name.`,
        mode: "alert",
      });
      return;
    }

    const ok = await confirm({
      title: "Create group?",
      message: `Are you sure you want to create the group "${trimmedName}"?`,
      confirmLabel: "Create",
    });
    if (!ok) return;

    setCreatingGroup(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const group = await res.json();
      setGroups([...groups, group]);
      setNewGroupName("");
      await loadSummary();
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const firstName = me?.name?.split(" ")[0] || me?.email?.split("@")[0];
  const totalGroups = groups.length;
  const uniquePeople = new Set(
    groups.flatMap((g: any) => (g.members || []).map((m: any) => m.userId))
  ).size;

  const visibleGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((g) => g.name?.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <>
      <DashboardTopBar
        me={me}
        pendingRequests={pendingRequests}
        onRespond={respondToRequest}
        onOpenInfo={() => setShowInfoOverlay(true)}
        onLogout={handleLogout}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="dash-shell-body">
        <Sidebar />

        <main className="dash-main">
          <div className="dash-page">
            <div className="hero-glow" />
            <div className="hero-grid" />

            <SFLoaderOverlay
              visible={initialLoading || creatingGroup}
              label={creatingGroup ? "Creating group" : "Loading your groups"}
            />

            <div className="dash-container">
              <div className="dash-header">
                <div>
                  <p className="dash-welcome">
                    {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
                  </p>
                  <div className="dash-title-row">
                    <h1 className="text-gradient dash-title">Dashboard</h1>
                    <RefreshButton onRefresh={refreshAll} label="Refreshing your dashboard" />
                  </div>
                </div>
              </div>

              <div className="dash-stats">
                <div className="dash-stat-card">
                  <p className="dash-stat-value">{totalGroups}</p>
                  <p className="dash-stat-label">
                    {totalGroups === 1 ? "active group" : "active groups"}
                  </p>
                </div>
                <div className="dash-stat-card">
                  <p className="dash-stat-value">{uniquePeople}</p>
                  <p className="dash-stat-label">people you split with</p>
                </div>
                <div onClick={() => setShowInfoOverlay(true)} className="dash-summary-card">
                  <div>
                    <p className="dash-summary-title">Full summary</p>
                    <p className="dash-summary-sub">Charts &amp; balances</p>
                  </div>
                  <span className="dash-summary-arrow">→</span>
                </div>
              </div>

              <div className="dash-actions-row">
                <PushNotificationButton />
                {process.env.NODE_ENV === "development" && (
                  <button
                    onClick={() => fetch("/api/push/test", { method: "POST" })}
                    className="dash-test-notif-btn"
                  >
                    Test notification
                  </button>
                )}
              </div>

              <div className="dash-section">
                <p className="dash-section-label">Your groups</p>
                <div className="dash-group-creator">
                  <input
                    placeholder="New group name — e.g. Goa Trip, Flat 4B"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newGroupName && !creatingGroup) createGroup();
                    }}
                    className="dash-group-input"
                  />
                  <button
                    onClick={createGroup}
                    disabled={!newGroupName || creatingGroup}
                    className="dash-create-btn"
                  >
                    {creatingGroup ? <Spinner /> : "Create"}
                  </button>
                </div>
              </div>

              <div className="dash-section" style={{ marginTop: "1rem" }}>
                {visibleGroups.length === 0 && !initialLoading ? (
                  <div className="dash-groups-empty">
                    <p>
                      {search.trim()
                        ? `No groups match "${search.trim()}".`
                        : "No groups yet — create your first one above to start splitting expenses."}
                    </p>
                  </div>
                ) : (
                  <div className="dash-groups-grid">
                    {visibleGroups.map((g) => {
                      const memberCount = g.members?.length || 0;
                      const previewMembers = (g.members || []).slice(0, 4);
                      const extraCount = memberCount - previewMembers.length;

                      return (
                        <Link key={g.id} href={`/groups/${g.id}`} className="dash-group-card">
                          <div className="dash-group-card-top">
                            <span className="dash-group-avatar">
                              {g.name?.[0]?.toUpperCase() || "?"}
                            </span>
                            <span className="dash-group-arrow">→</span>
                          </div>
                          <div>
                            <p className="dash-group-name">{g.name}</p>
                            <p className="dash-group-meta">
                              {memberCount} {memberCount === 1 ? "member" : "members"}
                            </p>
                          </div>
                          {memberCount > 0 && (
                            <div className="dash-group-members">
                              {previewMembers.map((m: any) => (
                                <span
                                  key={m.userId}
                                  title={m.user?.name || m.user?.email}
                                  className="dash-member-chip"
                                >
                                  {(m.user?.name || m.user?.email || "?")[0].toUpperCase()}
                                </span>
                              ))}
                              {extraCount > 0 && (
                                <span className="dash-member-chip extra">+{extraCount}</span>
                              )}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {showInfoOverlay && (
                <TableOverlay title="Your groups summary" onClose={() => setShowInfoOverlay(false)}>
                  {summaryRows.length === 0 ? (
                    <p style={{ color: "#888" }}>No groups yet.</p>
                  ) : (
                    <>
                      <GroupsSummaryGrid rows={summaryRows} />
                      <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                        Drag-select a range of numeric cells, right-click, then choose "Chart Range" to build a chart from any selection.
                      </p>
                    </>
                  )}
                </TableOverlay>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}