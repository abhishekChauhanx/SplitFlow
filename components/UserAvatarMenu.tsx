"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

function getInitials(name?: string | null, email?: string | null) {
  const source = (name && name.trim()) || (email && email.trim()) || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserAvatarMenu({
  name,
  email,
  onOpenInfo,
  onLogout,
}: {
  name?: string | null;
  email?: string | null;
  onOpenInfo: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = getInitials(name, email);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-[13px] font-bold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:ring-offset-black"
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-200/60 dark:border-white/10 dark:bg-zinc-900 dark:shadow-black/40">
          
          {/* User info header */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/10">
            <p className="truncate text-[13px] font-semibold text-zinc-900 dark:text-white">
              {name || "Account"}
            </p>
            {email && (
              <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-500">
                {email}
              </p>
            )}
          </div>

          {/* Information button */}
          <div className="border-b border-zinc-100 dark:border-white/10">
            <button
              onClick={() => { setOpen(false); onOpenInfo(); }}
              className="avatar-menu-item w-full text-left text-zinc-700 dark:text-zinc-300"
            >
              Information
            </button>
          </div>

          {/* Nav links */}
          <div className="border-b border-zinc-100 dark:border-white/10 py-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="avatar-menu-item text-zinc-500 dark:text-zinc-400"
            >
              Account
            </Link>
            <Link
              href="/vendor/dashboard"
              onClick={() => setOpen(false)}
              className="avatar-menu-item text-zinc-500 dark:text-zinc-400"
            >
              Vendor portal
            </Link>
            <Link
              href="/tenant/dashboard"
              onClick={() => setOpen(false)}
              className="avatar-menu-item text-zinc-500 dark:text-zinc-400"
            >
              My payments
            </Link>
            <Link
              href="/kitty"
              onClick={() => setOpen(false)}
              className="avatar-menu-item text-zinc-500 dark:text-zinc-400"
            >
              Collection pools
            </Link>
          </div>

          {/* Log out */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="avatar-menu-item w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}