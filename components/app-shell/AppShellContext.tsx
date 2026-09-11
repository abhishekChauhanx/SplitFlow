"use client";
import { createContext, useContext } from "react";

export type SidebarExtraItem = {
  href: string;
  label: string;
};

type AppShellCtx = {
  search: string;
  setSearch: (v: string) => void;
  pendingRequests: any[];
  refreshPendingRequests: () => Promise<void>;
  registerInfoHandler: (fn: (() => void) | null) => void;
  extraSidebarItems: SidebarExtraItem[];
  setExtraSidebarItems: (items: SidebarExtraItem[]) => void;
};

const Ctx = createContext<AppShellCtx | null>(null);

export function useAppShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppShell must be used inside AppShell");
  return ctx;
}

export { Ctx as AppShellContext };