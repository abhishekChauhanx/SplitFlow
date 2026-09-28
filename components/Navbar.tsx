"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import UserAvatarMenu from "@/components/UserAvatarMenu";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import SFLogo from "@/components/SFLogo";
import { useAuth } from "@/components/AuthProvider";
import { useOptionalAppShell, ChatNotice } from "@/components/app-shell/AppShellContext";

type PendingRequest = {
  id: string;
  action: string;
  groupId: string;
  groupName?: string;
  requestedBy: { name?: string | null; email?: string | null };
  expense: { description: string; amountPaise: number };
};

type CombinedItem =
  | { kind: "request"; data: PendingRequest }
  | { kind: "chat"; data: ChatNotice };

export default function Navbar({
  variant = "full",
}: {
  /** Only matters on public pages (outside AppShell).
   *  "full": logged-out users see Log in / Sign up.
   *  "minimal": hides them — for /login and /signup themselves. */
  variant?: "full" | "minimal";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, checkingAuth, clearMe } = useAuth();
  const shell = useOptionalAppShell(); // null on public pages
  const inApp = shell !== null;

  // The group search box only does something on the dashboard (it filters
  // the dashboard's group list), so it's hidden on every other page.
  const showSearch = pathname === "/dashboard";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearMe();
    router.push("/login");
  }

  const combinedItems: CombinedItem[] = shell
    ? [
        ...(shell.pendingRequests as PendingRequest[]).map((r) => ({ kind: "request" as const, data: r })),
        ...shell.chatNotices.map((c) => ({ kind: "chat" as const, data: c })),
      ]
    : [];

  const brand = (
    <Link
      href="/"
      aria-label="SplitFlow"
      className={inApp ? "dash-topbar-brand" : "text-lg font-semibold tracking-tight text-zinc-900 dark:text-white"}
      style={{ display: "flex", alignItems: "center" }}
    >
      <SFLogo height={22} />
    </Link>
  );

  const bell = shell && (
    <NotificationBell<CombinedItem>
      items={combinedItems}
      getKey={(item) => item.data.id}
      renderItem={(item) => {
        if (item.kind === "chat") {
          const notice = item.data;
          return (
            <div
              onClick={() => {
                shell.dismissChatNotice(notice.id);
                router.push(`/groups/${notice.groupId}`);
              }}
              style={{ cursor: "pointer" }}
            >
              <p className="mb-1 text-[13px] font-semibold text-zinc-900 dark:text-white">
                New message in {notice.groupName}
              </p>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-300">{notice.preview}</p>
            </div>
          );
        }

        const req = item.data;
        return (
          <>
            <p className="mb-2 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-white">
                {req.requestedBy.name || req.requestedBy.email}
              </span>{" "}
              wants to{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">{req.action}</span>{" "}
              "{req.expense.description}" — ₹{(req.expense.amountPaise / 100).toFixed(2)}
              {req.groupName ? (
                <span className="text-zinc-500 dark:text-zinc-500"> in {req.groupName}</span>
              ) : null}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => shell.respondToRequest(req.id, "approved")}
                className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
              >
                ✓ Approve
              </button>
              <button
                onClick={() => shell.respondToRequest(req.id, "denied")}
                className="flex-1 rounded-md bg-red-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
              >
                ✗ Deny
              </button>
            </div>
          </>
        );
      }}
    />
  );

  const avatar = (
    <UserAvatarMenu
      name={me?.name}
      email={me?.email}
      onOpenInfo={shell ? shell.openInfo : () => {}}
      onLogout={handleLogout}
    />
  );

  let actions: React.ReactNode;
  if (inApp) {
    actions = (
      <>
        <ThemeToggle />
        {bell}
        {avatar}
      </>
    );
  } else if (checkingAuth) {
    actions = <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />;
  } else if (me) {
    actions = (
      <>
        <ThemeToggle />
        <Link
          href="/dashboard"
          className="flex h-9 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
        >
          Dashboard
        </Link>
        {avatar}
      </>
    );
  } else if (variant === "full") {
    actions = (
      <>
        <ThemeToggle />
        <Link
          href="/login"
          className="flex h-9 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign up
        </Link>
      </>
    );
  } else {
    actions = <ThemeToggle />;
  }

  // ── In-app layout: keeps the existing dashboard-shell.css classes ──
  if (shell) {
    return (
      <header className="dash-topbar">
        {brand}

        {showSearch && (
          <div className="dash-topbar-search">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              value={shell.search}
              onChange={(e) => shell.setSearch(e.target.value)}
              placeholder="Search your groups..."
            />
          </div>
        )}

        <div className="dash-topbar-actions">{actions}</div>
      </header>
    );
  }

  // ── Public-page layout ──
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-black/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        {brand}
        <div className="flex items-center gap-3">{actions}</div>
      </div>
    </header>
  );
}