"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import UserAvatarMenu from "@/components/UserAvatarMenu";

type PendingRequest = {
  id: string;
  action: string;
  groupId: string;
  groupName?: string;
  requestedBy: { name?: string | null; email?: string | null };
  expense: { description: string; amountPaise: number };
};

export default function DashboardTopBar({
  me,
  pendingRequests,
  onRespond,
  onOpenInfo,
  onLogout,
  search,
  onSearchChange,
}: {
  me: { name?: string; email?: string } | null;
  pendingRequests: PendingRequest[];
  onRespond: (id: string, decision: "approved" | "denied") => void;
  onOpenInfo: () => void;
  onLogout: () => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <header className="dash-topbar">
      <Link href="/" className="dash-topbar-brand">
        SplitFlow
      </Link>

      <div className="dash-topbar-search">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search your groups..."
        />
      </div>

      <div className="dash-topbar-actions">
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
                  onClick={() => onRespond(req.id, "approved")}
                  className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => onRespond(req.id, "denied")}
                  className="flex-1 rounded-md bg-red-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
                >
                  ✗ Deny
                </button>
              </div>
            </>
          )}
        />
        <UserAvatarMenu name={me?.name} email={me?.email} onOpenInfo={onOpenInfo} onLogout={onLogout} />
      </div>
    </header>
  );
}