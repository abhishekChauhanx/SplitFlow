"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";

export function useTypingIndicator(
  groupId: string,
  currentUserId: string | null,
  currentUserName: string
) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`typing-${groupId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === currentUserId) return;
        setTypingUsers((prev) => (prev.includes(payload.name) ? prev : [...prev, payload.name]));
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== payload.name));
        }, 3000);
      })
      .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
        setTypingUsers((prev) => prev.filter((n) => n !== payload.name));
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId]);

  const notifyTyping = useCallback(() => {
  const name = currentUserName?.trim() || "Someone";
  channelRef.current?.send({
    type: "broadcast",
    event: "typing",
    payload: { userId: currentUserId, name },
  });

  if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
  stopTimeoutRef.current = setTimeout(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { name },
    });
  }, 2000);
}, [currentUserId, currentUserName]);

  return { typingUsers, notifyTyping };
}