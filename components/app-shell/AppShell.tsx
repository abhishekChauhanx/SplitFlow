"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Navbar from "@/components/Navbar";
import { AppShellContext, SidebarSection, ChatNotice } from "./AppShellContext";
import { useEditPermissionRealtime } from "@/lib/use-edit-permission-realtime";
import { useGlobalPresence } from "@/lib/use-global-presence";
import "@/components/dashboard/dashboard-shell.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
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

  const openInfo = useCallback(() => {
    infoHandlerRef.current?.();
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
      if (fetchId !== pendingRequestsFetchIdRef.current) return; // stale response, drop it
      if (Array.isArray(data)) setPendingRequests(data);
    }
  }, []);

  // Catch-up fetch: unread chat messages from before this session started
  const loadUnreadChatNotices = useCallback(async () => {
    const res = await fetch("/api/notifications/unread-messages");
    if (!res.ok) return;
    const notices: ChatNotice[] = await res.json();
    setChatNotices((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      return [...prev, ...notices.filter((n) => !existingIds.has(n.id))];
    });
  }, []);

  const respondToRequest = useCallback(
    async (id: string, decision: "approved" | "denied") => {
      await fetch(`/api/edit-permissions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      await refreshPendingRequests();
    },
    [refreshPendingRequests]
  );

  const pushChatNotice = useCallback((notice: ChatNotice) => {
    setChatNotices((prev) => {
      if (prev.some((n) => n.id === notice.id)) return prev; // dedupe by clientId
      return [notice, ...prev];
    });
  }, []);

  const clearChatNoticesForGroup = useCallback((groupId: string) => {
    setChatNotices((prev) => prev.filter((n) => n.groupId !== groupId));
  }, []);

  const dismissChatNotice = useCallback((id: string) => {
    setChatNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Realtime replaces polling — any INSERT/UPDATE on EditPermission
  // triggers a single refetch of the joined, shaped list.
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
        respondToRequest,
        registerInfoHandler,
        openInfo,
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
        <Navbar />
        <div className="dash-shell-body">
          <Sidebar section={sidebarSection} />
          <main className="dash-main">{children}</main>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}