"use client";

import { useEffect, useRef } from "react";

type Message = {
  id: string;
  clientId: string;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
  pendingSync?: boolean;
  sender: { id: string; name: string | null; email: string | null };
};

export default function MessageList({
  messages,
  currentUserId,
  onDelete,
}: {
  messages: Message[];
  currentUserId: string | null;
  onDelete: (id: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (stickToBottom.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < 120;
  }

  if (messages.length === 0) {
    return (
      <div className="chat-list chat-list-empty">
        <p>No messages yet — say hi 👋</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} onScroll={onScroll} className="chat-list">
      {messages.map((m, i) => {
        const mine = m.sender.id === currentUserId;
        const prev = messages[i - 1];
        const grouped =
          prev &&
          prev.sender.id === m.sender.id &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

        return (
          <div key={m.clientId || m.id} className={`chat-msg${mine ? " mine" : ""}${grouped ? " grouped" : ""}`}>
            {!grouped && (
              <p className="chat-msg-meta">
                {mine ? "You" : m.sender.name || m.sender.email}
                <span className="chat-msg-time">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
            )}

            <div className="chat-bubble">
              {m.deletedAt ? (
                <em className="chat-msg-deleted">Message deleted</em>
              ) : (
                m.body
              )}
              {m.pendingSync && <span className="chat-msg-pending">sending…</span>}
            </div>

            {mine && !m.deletedAt && !m.pendingSync && (
              <button className="chat-msg-delete" onClick={() => onDelete(m.id)}>
                Delete
              </button>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}