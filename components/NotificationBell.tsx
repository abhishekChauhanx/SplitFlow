"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

export default function NotificationBell<T>({
  items,
  getKey,
  renderItem,
  emptyMessage = "Nothing needs your attention.",
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = items.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-transparent text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-[#333] dark:text-[#ccc] dark:hover:bg-white/5"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-[3px] text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[500] max-h-[400px] w-[340px] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#161616]">
          <div className="border-b border-zinc-200 px-3.5 py-2.5 dark:border-[#2a2a2a]">
            <p className="m-0 text-[13px] font-semibold text-zinc-800 dark:text-[#eee]">
              Notifications {count > 0 && `(${count})`}
            </p>
          </div>

          {count === 0 ? (
            <p className="m-0 p-3.5 text-[13px] text-zinc-500 dark:text-[#888]">{emptyMessage}</p>
          ) : (
            items.map((item) => (
              <div
                key={getKey(item)}
                className="border-b border-zinc-100 px-3.5 py-2.5 last:border-b-0 dark:border-[#222]"
              >
                {renderItem(item)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}