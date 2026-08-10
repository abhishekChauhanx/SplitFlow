"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import { useModal } from "@/components/ModalProvider";
import UserAvatarMenu from "@/components/UserAvatarMenu";
import TableOverlay from "@/components/TableOverlay";
import GroupsSummaryGrid from "@/components/GroupsSummaryGrid";
import type { GroupSummaryRow } from "@/lib/dashboard-summary";

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

  const refreshAll = useCallback(async () => {
    await Promise.all([loadGroups(), loadSummary(), loadMe()]);
  }, [loadGroups, loadSummary, loadMe]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
  }, [refreshAll]);

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
      await loadSummary(); // new group starts with zero activity but should appear
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <SFLoaderOverlay
        visible={initialLoading || creatingGroup}
        label={creatingGroup ? "Creating group" : "Loading your groups"}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ margin: 0 }}>Your groups</h1>
          <RefreshButton onRefresh={refreshAll} label="Refreshing your groups" />
        </div>

        <UserAvatarMenu
          name={me?.name}
          email={me?.email}
          onOpenInfo={() => setShowInfoOverlay(true)}
          onLogout={handleLogout}
        />
      </div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0 24px" }}>
        <input
          placeholder="New group name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <button onClick={createGroup} disabled={!newGroupName || creatingGroup}>
          {creatingGroup ? <Spinner /> : "Create"}
        </button>
      </div>

      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            <Link href={`/groups/${g.id}`}>{g.name}</Link>
          </li>
        ))}
      </ul>

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
  );
}