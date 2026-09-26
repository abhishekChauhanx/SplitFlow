"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

export function useGroupPresence(
  groupId: string | null,
  currentUserId: string | null,
  active: boolean // only track presence while the chat panel is actually open
) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!groupId || !currentUserId || !active) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel(`presence-${groupId}`, {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ onlineAt: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId, active]);

  return onlineUserIds;
}