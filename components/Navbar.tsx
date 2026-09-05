"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserAvatarMenu from "@/components/UserAvatarMenu";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";

type Me = { name?: string; email?: string } | null;

// Same shape as the per-group PendingRequest type on the group page, minus
// the implicit groupId scoping (this is an aggregate across all groups).
type PendingRequest = {
  id: string;
  action: string;
  groupId: string;
  groupName?: string;
  requestedBy: { name?: string | null; email?: string | null };
  expense: { description: string; amountPaise: number };
};

export default function Navbar() {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        setMe(await res.json());
      } else {
        setMe(null);
      }
    } catch {
      setMe(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  // NOTE: the group page calls `/api/edit-permissions/pending?groupId=...`,
  // scoped to one group. On Home there's no group in context, so this needs
  // a global endpoint that returns pending requests across every group the
  // user belongs to. If that route doesn't exist yet, add one that mirrors
  // `/api/edit-permissions/pending` but drops the groupId filter.
  const loadPendingRequests = useCallback(() => {
    return fetch(`/api/edit-permissions/pending`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setPendingRequests(data);
      })
      .catch(() => {});
  }, []);

  const respondToRequest = useCallback(
    async (permissionId: string, decision: "approved" | "denied") => {
      await fetch(`/api/edit-permissions/${permissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      loadPendingRequests();
    },
    [loadPendingRequests]
  );

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!me) return;
    loadPendingRequests();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        loadPendingRequests();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [me, loadPendingRequests]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-black/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-8">
        {/* Logo / brand */}
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white"
        >
          YourApp
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {checkingAuth ? (
            // Reserve space so the navbar doesn't jump once auth resolves
            <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-white/10" />
          ) : me ? (
            <>
              <ThemeToggle />
              <NotificationBell<PendingRequest>
                items={pendingRequests}
                getKey={(req) => req.id}
                renderItem={(req) => (
                  <>
                    <p className="mb-2 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {req.requestedBy.name || req.requestedBy.email}
                      </span>{" "}
                      wants to{" "}
                      <span className="font-semibold text-zinc-900 dark:text-white">{req.action}</span> "
                      {req.expense.description}" — ₹{(req.expense.amountPaise / 100).toFixed(2)}
                      {req.groupName ? (
                        <span className="text-zinc-500 dark:text-zinc-500"> in {req.groupName}</span>
                      ) : null}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToRequest(req.id, "approved")}
                        className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => respondToRequest(req.id, "denied")}
                        className="flex-1 rounded-md bg-red-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
                      >
                        ✗ Deny
                      </button>
                    </div>
                  </>
                )}
              />
              <UserAvatarMenu
                name={me.name}
                email={me.email}
                onOpenInfo={() => setShowInfoOverlay(true)}
                onLogout={handleLogout}
              />
            </>
          ) : (
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
          )}
        </div>
      </div>

      {/* Placeholder hook: reuse TableOverlay/info modal here if the avatar's
          "info" action should show something on the home page too. Left
          out by default since Home doesn't have group summary data. */}
      {showInfoOverlay && null}
    </header>
  );
}