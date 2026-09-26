"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import { AppShellContext, SidebarSection, ChatNotice } from "./AppShellContext";
import { useEditPermissionRealtime } from "@/lib/use-edit-permission-realtime";
import { useGlobalPresence } from "@/lib/use-global-presence";
import "@/components/dashboard/dashboard-shell.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<{ userId?: string; name?: string; email?: string } | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>(null);
  const [chatNotices, setChatNotices] = useState<ChatNotice[]>([]);
  const infoHandlerRef = useRef<(() => void) | null>(null);
  const pendingRequestsFetchIdRef = useRef(0);

  const onlineUserIds = useGlobalPresence(me?.userId ?? null);

  const registerInfoHandler = useCallback((fn: (() => void) | null) => {
    infoHandlerRef.current = fn;
  }, []);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) setMe(await res.json());
  }, []);

  const refreshPendingRequests = useCallback(async () => {
    const fetchId = ++pendingRequestsFetchIdRef.current;

    const res = await fetch("/api/edit-permissions/pending");
    if (res.ok) {
      const data = await res.json();
      if (fetchId !== pendingRequestsFetchIdRef.current) return;
      if (Array.isArray(data)) setPendingRequests(data);
    }
  }, []);

  const loadUnreadChatNotices = useCallback(async () => {
    const res = await fetch("/api/notifications/unread-messages");
    if (!res.ok) return;
    const notices: ChatNotice[] = await res.json();
    setChatNotices((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const merged = [...prev, ...notices.filter((n) => !existingIds.has(n.id))];
      return merged;
    });
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

  const pushChatNotice = useCallback((notice: ChatNotice) => {
    setChatNotices((prev) => {
      if (prev.some((n) => n.id === notice.id)) return prev;
      return [notice, ...prev];
    });
  }, []);

  const clearChatNoticesForGroup = useCallback((groupId: string) => {
    setChatNotices((prev) => prev.filter((n) => n.groupId !== groupId));
  }, []);

  const dismissChatNotice = useCallback((id: string) => {
    setChatNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  useEditPermissionRealtime(me?.userId ?? null, () => {
    refreshPendingRequests();
  });

  useEffect(() => {
    loadMe();
    refreshPendingRequests();
    loadUnreadChatNotices();
  }, [loadMe, refreshPendingRequests, loadUnreadChatNotices]);

  return (
    <AppShellContext.Provider
      value={{
        search,
        setSearch,
        pendingRequests,
        refreshPendingRequests,
        registerInfoHandler,
        sidebarSection,
        setSidebarSection,
        chatNotices,
        pushChatNotice,
        clearChatNoticesForGroup,
        dismissChatNotice,
        onlineUserIds,
      }}
    >
      <div className="dash-shell">
        <DashboardTopBar
          me={me}
          pendingRequests={pendingRequests}
          chatNotices={chatNotices}
          onDismissChatNotice={dismissChatNotice}
          onRespond={respondToRequest}
          onOpenInfo={() => infoHandlerRef.current?.()}
          onLogout={handleLogout}
          search={search}
          onSearchChange={setSearch}
        />
        <div className="dash-shell-body">
          <Sidebar section={sidebarSection} />
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}