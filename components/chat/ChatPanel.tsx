"use client";

import { useEffect } from "react";

export default function ChatPanel({
  open,
  onClose,
  groupName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  groupName: string;
  children: React.ReactNode;
}) {
  // close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`chat-panel-backdrop${open ? " open" : ""}`}
        onClick={onClose}
      />
      <div className={`chat-slideover${open ? " open" : ""}`}>
        <div className="chat-slideover-header">
          <div>
            <p className="chat-slideover-eyebrow">Group chat</p>
            <p className="chat-slideover-title">{groupName}</p>
          </div>
          <button
            className="chat-slideover-close"
            onClick={onClose}
            aria-label="Close chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="chat-slideover-body">{children}</div>
      </div>
    </>
  );
}