"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";

export default function DashboardPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  async function createGroup() {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName }),
    });
    const group = await res.json();
    setGroups([...groups, group]);
    setNewGroupName("");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
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
        <button onClick={createGroup} disabled={!newGroupName}>Create</button>
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