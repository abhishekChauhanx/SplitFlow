"use client";

import { useState, useRef, useEffect } from "react";

type PendingRequest = {
  id: string;
  action: string;
  requestedBy: { name?: string | null; email?: string | null };
  expense: { description: string; amountPaise: number };
};

export default function NotificationBell({
  requests,
  onApprove,
  onDeny,
}: {
  requests: PendingRequest[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = requests.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "transparent",
          border: "1px solid #333",
          color: "#ccc",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: "0 3px",
              borderRadius: 8,
              background: "#dc2626",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 340,
            maxHeight: 400,
            overflowY: "auto",
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 500,
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#eee" }}>
              Notifications {count > 0 && `(${count})`}
            </p>
          </div>

          {count === 0 ? (
            <p style={{ padding: 14, margin: 0, fontSize: 13, color: "#888" }}>Nothing needs your attention.</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} style={{ padding: "10px 14px", borderBottom: "1px solid #222" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#ccc", lineHeight: 1.4 }}>
                  <strong>{req.requestedBy.name || req.requestedBy.email}</strong> wants to{" "}
                  <strong>{req.action}</strong> "{req.expense.description}" — ₹
                  {(req.expense.amountPaise / 100).toFixed(2)}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onApprove(req.id)}
                    style={{ flex: 1, background: "#16a34a", color: "#fff", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => onDeny(req.id)}
                    style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", padding: "6px 0", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                  >
                    ✗ Deny
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}