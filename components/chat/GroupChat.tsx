"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import MessageList from "@/components/chat/MessageList";
import MessageComposer from "@/components/chat/MessageComposer";
import { useGroupChatRealtime } from "@/lib/use-group-chat-realtime";
import { generateClientId } from "@/lib/offline-queue";
import { useOnlineStatus } from "@/components/useOnlineStatus";

export default function GroupChat({
  groupId,
  currentUserId,
  active, // true only while the panel is open — controls whether we mark-read
}: {
  groupId: string;
  currentUserId: string | null;
  active: boolean;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;

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
  }, [active, markRead, messages.length]);

  // Live updates — fires for every INSERT on this group, from any sender
  useGroupChatRealtime(groupId, (incoming) => {
    setMessages((prev) => {
      const seen = prev.some((m) => m.clientId === incoming.clientId);
      if (seen) {
        // reconcile: our own optimistic row already exists — replace it
        // with the real one (fetch sender details, since realtime payload
        // doesn't include the joined sender record)
        return prev.map((m) => (m.clientId === incoming.clientId ? { ...incoming, sender: m.sender } : m));
      }
      // a message from someone else — we don't have their sender details
      // from the realtime payload alone, so do a light refetch of just
      // this one message via history endpoint on next poke; simplest fix
      // for now is a full reload of the tail, acceptable at this scale
      loadHistory();
      return prev;
    });
    if (active) markRead();
  });

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
      <MessageList messages={messages} currentUserId={currentUserId} onDelete={remove} />
      <MessageComposer onSend={send} />
    </div>
  );
}