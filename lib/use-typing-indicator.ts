"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";

export function useTypingIndicator(groupId: string, currentUserId: string | null, currentUserName: string) {
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
        setTypingUsers((prev) =>
          prev.includes(payload.name) ? prev : [...prev, payload.name]
        );
        // auto-clear if no follow-up "stop" arrives within 3s
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
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, name: currentUserName },
    });

    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    stopTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "stop_typing",
        payload: { name: currentUserName },
      });
    }, 2000); // stop broadcasting "typing" after 2s of no keystrokes
  }, [currentUserId, currentUserName]);

  return { typingUsers, notifyTyping };
}