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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            minWidth: 200,
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 500,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #2a2a2a" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#eee" }}>
              {name || "Account"}
            </p>
            {email && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#888" }}>{email}</p>}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onOpenInfo();
            }}
            style={menuItemStyle}
          >
            Information
          </button>
        
            <Link href="/account" style={{ fontSize: 13, color: "#888" }}>Account</Link>
        
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            style={{ ...menuItemStyle, color: "#f87171" }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 14px",
  background: "transparent",
  border: "none",
  color: "#ccc",
  fontSize: 13,
  cursor: "pointer",
};