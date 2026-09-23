"use client";

import { useGroupChatRealtime } from "@/lib/use-group-chat-realtime";
import { useAppShell } from "@/components/app-shell/AppShellContext";

export default function GroupChatListener({
  groupId,
  groupName,
  currentUserId,
  active,
  onIncoming,
}: {
  groupId: string;
  groupName: string;
  currentUserId: string | null;
  active: boolean; // true only while the panel is open
  onIncoming: (message: any) => void; // lets the open panel's message list update too
}) {
  const { pushChatNotice, clearChatNoticesForGroup } = useAppShell();

  useGroupChatRealtime(groupId, (incoming) => {
    onIncoming(incoming);

    const isMine = incoming.senderId === currentUserId;
    if (!active && !isMine) {
      pushChatNotice({
        id: incoming.clientId,
        groupId,
        groupName,
        preview: incoming.body.length > 60 ? incoming.body.slice(0, 60) + "…" : incoming.body,
      });
    }
  });

  return null; // renders nothing — pure subscription
}