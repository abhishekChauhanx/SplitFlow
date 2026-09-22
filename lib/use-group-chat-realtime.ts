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
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert; // always call the latest closure, avoids stale state

  useEffect(() => {
    if (!groupId) return;

    const channel: RealtimeChannel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Message", filter: `groupId=eq.${groupId}` },
        (payload) => onInsertRef.current(payload.new as MessageRow)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);
}