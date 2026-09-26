"use client";

import { useEffect, useRef, useState } from "react";

type Member = { userId: string; user: { name: string | null; email: string | null } };

type Message = {
  id: string;
  clientId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  pendingSync?: boolean;
  sender: { id: string; name: string | null; email: string | null };
};

type MessageStatus = "pending" | "sent" | "delivered" | "read";

function getMessageStatus(
  m: Message,
  currentUserId: string | null,
  members: Member[],
  onlineUserIds: Set<string>,
  readMap: Record<string, string>
): MessageStatus {
  if (m.pendingSync) return "pending";

  const others = members.filter((mem) => mem.userId !== currentUserId);
  if (others.length === 0) return "sent";

  const msgTime = new Date(m.createdAt).getTime();

  const allRead = others.every((o) => {
    const lastRead = readMap[o.userId];
    return lastRead && new Date(lastRead).getTime() >= msgTime;
  });
  if (allRead) return "read";

  const anyOnline = others.some((o) => onlineUserIds.has(o.userId));
  return anyOnline ? "delivered" : "sent";
}

function StatusIcon({ status }: { status: MessageStatus }) {
  if (status === "pending") {
    return (
      <svg className="chat-status-icon" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "sent") {
    return (
      <svg className="chat-status-icon" viewBox="0 0 16 16" fill="none">
        <path d="M2 8.5L5.5 12L14 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="chat-status-icon" viewBox="0 0 20 16" fill="none">
      <path d="M1 8.5L4.5 12L13 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8.5L10.5 12L19 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MessageList({
  messages,
  currentUserId,
  members,
  onlineUserIds,
  readMap,
  onDelete,
  onSaveEdit,
}: {
  messages: Message[];
  currentUserId: string | null;
  members: Member[];
  onlineUserIds: Set<string>;
  readMap: Record<string, string>;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, newBody: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  function startEdit(m: Message) {
    setEditingId(m.id);
    setEditValue(m.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function confirmEdit() {
    if (!editingId || !editValue.trim()) return;
    onSaveEdit(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (messages.length === 0) {
    return (
      <div className="chat-list chat-list-empty">
        <p>No messages yet — say hi 👋</p>
      </div>
    );
  }

  function renderBodyWithMentions(body: string) {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let key = 0;

    for (const match of body.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)) {
      const [full, name] = match;
      const start = match.index!;
      if (start > lastIndex) parts.push(body.slice(lastIndex, start));
      parts.push(<span key={key++} className="chat-mention-tag">@{name}</span>);
      lastIndex = start + full.length;
    }
    if (lastIndex < body.length) parts.push(body.slice(lastIndex));

    return parts;
  }

  return (
    <div ref={containerRef} onScroll={onScroll} className="chat-list">
      {messages.map((m, i) => {
        const mine = m.sender.id === currentUserId;
        const prev = messages[i - 1];
        const sameSenderAsPrev = prev && prev.sender.id === m.sender.id;
        const isEditing = editingId === m.id;
        const status = mine ? getMessageStatus(m, currentUserId, members, onlineUserIds, readMap) : null;

        return (
          <div key={m.clientId || m.id} className={`chat-msg${mine ? " mine" : ""}${sameSenderAsPrev ? " grouped" : ""}`}>
            {!sameSenderAsPrev && (
              <p className="chat-msg-meta">
                {mine ? "You" : m.sender.name || m.sender.email}
              </p>
            )}

            {isEditing ? (
              <div className="chat-bubble-edit">
                <textarea
                  className="chat-bubble-edit-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      confirmEdit();
                    }
                    if (e.key === "Escape") cancelEdit();
                  }}
                  autoFocus
                  rows={2}
                />
                <div className="chat-bubble-edit-actions">
                  <button className="chat-msg-delete" onClick={cancelEdit}>Cancel</button>
                  <button className="chat-bubble-edit-save" onClick={confirmEdit} disabled={!editValue.trim()}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="chat-bubble-row">
                  <div className="chat-bubble">
                    {m.deletedAt ? (
                      <em className="chat-msg-deleted">Message deleted</em>
                    ) : (
                      <>
                        {renderBodyWithMentions(m.body)}
                        {m.editedAt && <span className="chat-msg-edited-tag"> (edited)</span>}
                      </>
                    )}
                    {m.pendingSync && <span className="chat-msg-pending">sending…</span>}
                  </div>

                  <span className="chat-msg-time-always">
                    {formatTime(m.createdAt)}
                    {status && (
                      <span className={`chat-status${status === "read" ? " chat-status-read" : ""}`}>
                        <StatusIcon status={status} />
                      </span>
                    )}
                  </span>
                </div>

                {mine && !m.deletedAt && !m.pendingSync && (
                  <div className="chat-msg-actions">
                    <button className="chat-msg-delete" onClick={() => startEdit(m)}>Edit</button>
                    <button className="chat-msg-delete" onClick={() => onDelete(m.id)}>Delete</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}