"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

export function useGroupPresence(
  groupId: string | null,
  currentUserId: string | null
) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!groupId || !currentUserId) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel(`presence-${groupId}`, {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const ids = Object.keys(channel.presenceState());
        setOnlineUserIds(new Set(ids));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ onlineAt: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId]);

  return onlineUserIds;
}