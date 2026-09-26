"use client";
import { createContext, useContext } from "react";

export type SidebarExtraItem = {
  href: string;
  label: string;
};

export type SidebarSection = {
  label: string;
  href?: string;
  items: SidebarExtraItem[];
} | null;

export type ChatNotice = {
  id: string;
  groupId: string;
  groupName: string;
  preview: string;
  senderName: string;
};

type AppShellCtx = {
  search: string;
  setSearch: (v: string) => void;
  pendingRequests: any[];
  refreshPendingRequests: () => Promise<void>;
  registerInfoHandler: (fn: (() => void) | null) => void;
  sidebarSection: SidebarSection;
  setSidebarSection: (section: SidebarSection) => void;
  chatNotices: ChatNotice[];
  pushChatNotice: (notice: ChatNotice) => void;
  clearChatNoticesForGroup: (groupId: string) => void;
  dismissChatNotice: (id: string) => void;
  onlineUserIds: Set<string>; // app-wide — anyone currently logged in anywhere
};

const Ctx = createContext<AppShellCtx | null>(null);

export function useAppShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppShell must be used inside AppShell");
  return ctx;
}

export { Ctx as AppShellContext };