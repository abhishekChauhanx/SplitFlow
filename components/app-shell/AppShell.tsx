"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import { AppShellContext, SidebarExtraItem } from "./AppShellContext";
import "@/components/dashboard/dashboard-shell.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<{ name?: string; email?: string } | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [extraSidebarItems, setExtraSidebarItems] = useState<SidebarExtraItem[]>([]);
  const infoHandlerRef = useRef<(() => void) | null>(null);

  const registerInfoHandler = useCallback((fn: (() => void) | null) => {
    infoHandlerRef.current = fn;
  }, []);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) setMe(await res.json());
  }, []);

  const refreshPendingRequests = useCallback(async () => {
    const res = await fetch("/api/edit-permissions/pending");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setPendingRequests(data);
    }
  }, []);

  const respondToRequest = useCallback(
    async (id: string, decision: "approved" | "denied") => {
      await fetch(`/api/edit-permissions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      refreshPendingRequests();
    },
    [refreshPendingRequests]
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  useEffect(() => {
    loadMe();
    refreshPendingRequests();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        refreshPendingRequests();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loadMe, refreshPendingRequests]);

  return (
    <AppShellContext.Provider
      value={{
        search,
        setSearch,
        pendingRequests,
        refreshPendingRequests,
        registerInfoHandler,
        extraSidebarItems,
        setExtraSidebarItems,
      }}
    >
      <div className="dash-shell">
        <DashboardTopBar
          me={me}
          pendingRequests={pendingRequests}
          onRespond={respondToRequest}
          onOpenInfo={() => infoHandlerRef.current?.()}
          onLogout={handleLogout}
          search={search}
          onSearchChange={setSearch}
        />
        <div className="dash-shell-body">
          <Sidebar extraItems={extraSidebarItems} />
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}