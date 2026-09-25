"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type EditPermissionRow = {
  id: string;
  expenseId: string;
  requestedById: string;
  ownerId: string;
  action: string;
  status: string;
  notified: boolean;
};

let instanceCounter = 0;

export function useEditPermissionRealtime(
  currentUserId: string | null,
  onChange: (row: EditPermissionRow, eventType: "INSERT" | "UPDATE") => void
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Unique per hook *instance*, not per user — prevents AppShell's and
  // GroupDetailPage's subscriptions from colliding on the same topic.
  const instanceIdRef = useRef<number>(++instanceCounter);

  useEffect(() => {
    if (!currentUserId) return;

    const topic = `edit-permissions-${currentUserId}-${instanceIdRef.current}`;

    // Defensive: clear any stale channel with this exact topic first,
    // in case a previous cleanup hasn't fully resolved yet (StrictMode,
    // fast refresh, re-renders before unmount completes).
    const existing = supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${topic}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel: RealtimeChannel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "EditPermission" },
        (payload) =>
          onChangeRef.current(payload.new as EditPermissionRow, "INSERT")
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "EditPermission" },
        (payload) =>
          onChangeRef.current(payload.new as EditPermissionRow, "UPDATE")
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}