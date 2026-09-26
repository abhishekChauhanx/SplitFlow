"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

// One shared presence channel for the whole app — everyone currently
// logged in (on ANY page) tracks themselves here, so "online" means
// "has the app open somewhere," not "viewing this specific group."
export function useGlobalPresence(currentUserId: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel("presence-global", {
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
  }, [currentUserId]);

  return onlineUserIds;
}