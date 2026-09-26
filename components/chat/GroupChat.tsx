"use client";

import { useEffect, useState, useCallback } from "react";
import MessageList from "@/components/chat/MessageList";
import MessageComposer from "@/components/chat/MessageComposer";
import Spinner from "@/components/Spinner";
import { generateClientId } from "@/lib/offline-queue";
import { useOnlineStatus } from "@/components/useOnlineStatus";
import { useTypingIndicator } from "@/lib/use-typing-indicator";
import { useGroupPresence } from "@/lib/use-group-presence";
import { useGroupReadReceipts } from "@/lib/use-group-read-receipts";

export default function GroupChat({
  groupId,
  currentUserId,
  currentUserName,
  active,
  incomingMessage,
  members
}: {
  groupId: string;
  currentUserId: string | null;
  currentUserName: string;
  active: boolean;
  incomingMessage: any | null;
  members: { userId: string; user: { name: string | null; email: string | null } }[];
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const { typingUsers, notifyTyping } = useTypingIndicator(groupId, currentUserId, currentUserName);
  const onlineUserIds = useGroupPresence(groupId, currentUserId, active);
  const readMap = useGroupReadReceipts(groupId);

  const markRead = useCallback(() => {
    fetch(`/api/groups/${groupId}/messages/read`, { method: "POST" }).catch(() => {});
  }, [groupId]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/messages`);
    if (!res.ok) return;
    setMessages(await res.json());
  }, [groupId]);

  useEffect(() => {
    loadHistory().finally(() => setLoading(false));
  }, [loadHistory]);

  useEffect(() => {
    if (active) markRead();
  }, [active, markRead]);

  useEffect(() => {
    if (!incomingMessage) return;
    setMessages((prev) => {
      const seen = prev.some((m) => m.clientId === incomingMessage.clientId);
      if (seen) {
        return prev.map((m) =>
          m.clientId === incomingMessage.clientId ? { ...incomingMessage, sender: m.sender } : m
        );
      }
      loadHistory();
      return prev;
    });
    if (active) markRead();
  }, [incomingMessage, active, markRead, loadHistory]);

  async function send(body: string, mentionIds: string[]) {
    const clientId = generateClientId();
    const optimistic = {
      id: `pending-${clientId}`,
      clientId,
      body,
      mentionIds,
      createdAt: new Date().toISOString(),
      pendingSync: true,
      sender: { id: currentUserId, name: "You", email: null },
    };
    setMessages((prev) => [...prev, optimistic]);

    if (!isOnline) {
      const { enqueueMessage } = await import("@/lib/offline-queue");
      await enqueueMessage({ clientId, groupId, body, createdAt: Date.now() });
      return;
    }

    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, clientId, mentionIds }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? saved : m)));
    } catch {
      const { enqueueMessage } = await import("@/lib/offline-queue");
      await enqueueMessage({ clientId, groupId, body, createdAt: Date.now() });
    }
  }

  async function remove(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m))
    );
    await fetch(`/api/messages/${messageId}`, { method: "DELETE" }).catch(() => {});
  }

  async function saveEdit(messageId: string, newBody: string) {
    const prevMessages = messages;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, body: newBody, editedAt: new Date().toISOString() } : m))
    );
    const res = await fetch(`/api/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setMessages(prevMessages);
    }
  }

  if (loading) {
    return (
      <div className="chat-list chat-list-empty">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="chat-panel-body">
      {!isOnline && (
        <div className="group-banner offline" style={{ margin: "0.75rem 0.75rem 0" }}>
          📡 Offline — messages will send once you're back online.
        </div>
      )}

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        members={members}
        onlineUserIds={onlineUserIds}
        readMap={readMap}
        onDelete={remove}
        onSaveEdit={saveEdit}
      />

      {typingUsers.length > 0 && (
        <div className="chat-typing-indicator">
          <span className="chat-typing-dots"><span></span><span></span><span></span></span>
          <span className="chat-typing-text">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing…`
              : `${typingUsers.join(", ")} are typing…`}
          </span>
        </div>
      )}

      <MessageComposer onSend={send} onTyping={notifyTyping} members={members} currentUserId={currentUserId} />
    </div>
  );
}