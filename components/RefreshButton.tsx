"use client";

import { useState } from "react";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";

export default function RefreshButton({
  onRefresh,
  label = "Refreshing...",
}: {
  onRefresh: () => Promise<any> | void;
  label?: string;
}) {
  const [spinning, setSpinning] = useState(false);

  async function handleClick() {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setSpinning(false), 500);
    }
  }

  return (
    <>
      <SFLoaderOverlay visible={spinning} label={label} />

      <button
        onClick={handleClick}
        aria-label="Refresh"
        title="Refresh"
        disabled={spinning}
        className="refresh-btn"
      >
        <svg
          className={`refresh-btn-icon${spinning ? " spinning" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </>
  );
}