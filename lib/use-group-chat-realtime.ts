"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type MessageRow = {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  clientId: string;
  createdAt: string;
  deletedAt: string | null;
};

export function useGroupChatRealtime(
  groupId: string | null,
  onInsert: (message: MessageRow) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `groupId=eq.${groupId}`,
        },
        (payload) => {
          onInsert(payload.new as MessageRow);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps
}