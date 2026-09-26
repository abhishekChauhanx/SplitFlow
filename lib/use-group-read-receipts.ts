"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type ReadMap = Record<string, string>; // userId -> lastReadAt ISO

export function useGroupReadReceipts(groupId: string | null) {
  const [readMap, setReadMap] = useState<ReadMap>({});

  const loadInitial = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/groups/${groupId}/reads`);
    if (!res.ok) return;
    const rows: { userId: string; lastReadAt: string }[] = await res.json();
    setReadMap(Object.fromEntries(rows.map((r) => [r.userId, r.lastReadAt])));
  }, [groupId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!groupId) return;

    function upsert(row: { userId: string; lastReadAt: string }) {
      setReadMap((prev) => ({ ...prev, [row.userId]: row.lastReadAt }));
    }

    const channel: RealtimeChannel = supabase
      .channel(`group-reads-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "MessageRead", filter: `groupId=eq.${groupId}` },
        (payload) => upsert(payload.new as any)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "MessageRead", filter: `groupId=eq.${groupId}` },
        (payload) => upsert(payload.new as any)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return readMap;
}