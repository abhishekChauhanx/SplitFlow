"use client";

import { useState } from "react";

export default function RefreshButton({
  onRefresh,
}: {
  onRefresh: () => Promise<any> | void;
}) {
  const [spinning, setSpinning] = useState(false);

  async function handleClick() {
    if (spinning) return; // avoid stacking clicks while one refresh is in flight
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      // Keep the spin visible for a moment even if the fetch was instant,
      // so the click always feels like it did something.
      setTimeout(() => setSpinning(false), 500);
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Refresh"
      title="Refresh"
      disabled={spinning}
      style={{
        background: "none",
        border: "1px solid #333",
        borderRadius: 6,
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: spinning ? "default" : "pointer",
        opacity: spinning ? 0.7 : 1,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: spinning ? "spin 0.6s linear infinite" : "none",
        }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}