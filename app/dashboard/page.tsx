"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import Spinner from "@/components/Spinner";
import PageLoader from "@/components/PageLoader";
import { useModal } from "@/components/ModalProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { confirm } = useModal();
  const [groups, setGroups] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data);
  }, []);

  useEffect(() => {
    loadGroups().finally(() => setInitialLoading(false));
  }, [loadGroups]);

  async function createGroup() {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;

    // Case-insensitive check against groups already loaded for this user
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
      {(initialLoading || creatingGroup) && (
        <PageLoader label={creatingGroup ? "Creating group" : "Loading your groups"} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ margin: 0 }}>Your groups</h1>
          <RefreshButton onRefresh={loadGroups} />
        </div>
        <button onClick={handleLogout}>Log out</button>
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
    </div>
  );
}