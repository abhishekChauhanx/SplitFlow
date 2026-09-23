"use client";

import { useEffect, useState, useCallback } from "react";
import MessageList from "@/components/chat/MessageList";
import MessageComposer from "@/components/chat/MessageComposer";
import { generateClientId } from "@/lib/offline-queue";
import { useOnlineStatus } from "@/components/useOnlineStatus";
import { useTypingIndicator } from "@/lib/use-typing-indicator";

export default function GroupChat({
  groupId,
  currentUserId,
  currentUserName,
  active,
  incomingMessage,
}: {
  groupId: string;
  currentUserId: string | null;
  currentUserName: string;
  active: boolean;
  incomingMessage: any | null;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const { typingUsers, notifyTyping } = useTypingIndicator(groupId, currentUserId, currentUserName);

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

  // reconciles both new messages (INSERT) and edits/deletes (UPDATE) —
  // the listener sends both event types through this same callback
  useEffect(() => {
    if (!incomingMessage) return;
    setMessages((prev) => {
      const seen = prev.some((m) => m.clientId === incomingMessage.clientId);
      if (seen) {
        return prev.map((m) =>
          m.clientId === incomingMessage.clientId ? { ...incomingMessage, sender: m.sender } : m
        );
      }
      loadHistory(); // new message from someone else — refetch to get joined sender info
      return prev;
    });
    if (active) markRead();
  }, [incomingMessage, active, markRead, loadHistory]);

  async function send(body: string) {
    const clientId = generateClientId();
    const optimistic = {
      id: `pending-${clientId}`,
      clientId,
      body,
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
        body: JSON.stringify({ body, clientId }),
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
      setMessages(prevMessages); // roll back on failure
    }
  }

  if (loading) {
    return <div className="chat-list chat-list-empty"><p>Loading chat…</p></div>;
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
        onDelete={remove}
        onSaveEdit={saveEdit}
      />

      {typingUsers.length > 0 && (
        <div className="chat-typing-indicator">
          <span className="chat-typing-dots"><span></span><span></span><span></span></span>
          {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
        </div>
      )}

      <MessageComposer onSend={send} onTyping={notifyTyping} />
    </div>
  );
}