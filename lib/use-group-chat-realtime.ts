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

function normalizeTimestamp(raw: string): string {
  if (!raw) return raw;
  // Already has an explicit offset or Z — leave it alone.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) return raw;
  // Turn "2026-09-26 05:14:03.761" into "2026-09-26T05:14:03.761Z"
  return raw.replace(" ", "T") + "Z";
}

export function useGroupChatRealtime(
  groupId: string | null,
  onInsert: (message: MessageRow) => void
) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (!groupId) return;

    function handlePayload(row: MessageRow) {
      onInsertRef.current({
        ...row,
        createdAt: normalizeTimestamp(row.createdAt),
      });
    }

    const channel: RealtimeChannel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Message", filter: `groupId=eq.${groupId}` },
        (payload) => handlePayload(payload.new as MessageRow)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Message", filter: `groupId=eq.${groupId}` },
        (payload) => handlePayload(payload.new as MessageRow)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);
}