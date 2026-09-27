"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";
import TableOverlay from "@/components/TableOverlay";
import GroupsSummaryGrid from "@/components/GroupsSummaryGrid";
import type { GroupSummaryRow } from "@/lib/dashboard-summary";
import PushNotificationButton from "@/components/PushNotificationButton";
import { useAppShell } from "@/components/app-shell/AppShellContext";
import "../../home.css";
import "./dashboard.css";

type GroupFilter = "active" | "archived" | "all";

const FILTER_LABELS: Record<GroupFilter, string> = {
  active: "Normal groups",
  archived: "Archived groups",
  all: "All groups",
};

export default function DashboardPage() {
  const { confirm } = useModal();
  const { search, registerInfoHandler } = useAppShell();

  const [groups, setGroups] = useState<any[]>([]);
  const [summaryRows, setSummaryRows] = useState<GroupSummaryRow[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);

  const [groupFilter, setGroupFilter] = useState<GroupFilter>("active");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const loadGroups = useCallback(async (filter: GroupFilter = groupFilter) => {
    const res = await fetch(`/api/groups?status=${filter}`);
    const data = await res.json();
    setGroups(data);
  }, [groupFilter]);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/dashboard/groups-summary");
    if (res.ok) setSummaryRows(await res.json());
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadGroups(), loadSummary()]);
  }, [loadGroups, loadSummary]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
  }, [refreshAll]);

  // Re-fetch whenever the filter changes (after the very first load)
  useEffect(() => {
    if (initialLoading) return;
    loadGroups(groupFilter);
  }, [groupFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the filter dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Let AppShell's topbar "info" button open this page's overlay.
  useEffect(() => {
    registerInfoHandler(() => setShowInfoOverlay(true));
    return () => registerInfoHandler(null);
  }, [registerInfoHandler]);

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
      // Only splice it into the visible list if the current filter would
      // actually show a brand-new (non-archived) group.
      if (groupFilter !== "archived") {
        setGroups([...groups, group]);
      }
      setNewGroupName("");
      await loadSummary();
    } finally {
      setCreatingGroup(false);
    }
  }

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

          <div className="dash-group-filter-row">
            <div ref={filterMenuRef} className="dash-group-filter">
              <button
                className="dash-group-filter-trigger"
                onClick={() => setFilterMenuOpen((o) => !o)}
              >
                {FILTER_LABELS[groupFilter]}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {filterMenuOpen && (
                <div className="dash-group-filter-menu">
                  {(Object.keys(FILTER_LABELS) as GroupFilter[]).map((key) => (
                    <button
                      key={key}
                      className={`dash-group-filter-option${key === groupFilter ? " active" : ""}`}
                      onClick={() => {
                        setGroupFilter(key);
                        setFilterMenuOpen(false);
                      }}
                    >
                      {FILTER_LABELS[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dash-section" style={{ marginTop: "1rem" }}>
          {visibleGroups.length === 0 && !initialLoading ? (
            <div className="dash-groups-empty">
              <p>
                {search.trim()
                  ? `No groups match "${search.trim()}".`
                  : groupFilter === "archived"
                    ? "No archived groups."
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
                  <Link
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className={`dash-group-card${g.archivedAt ? " archived" : ""}`}
                  >
                    <div className="dash-group-card-top">
                      <span className="dash-group-avatar">
                        {g.name?.[0]?.toUpperCase() || "?"}
                      </span>
                      {g.archivedAt ? (
                        <span className="dash-group-archived-tag">Archived</span>
                      ) : (
                        <span className="dash-group-arrow">→</span>
                      )}
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
  );
}