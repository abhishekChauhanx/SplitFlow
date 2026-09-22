"use client";

import { useEffect, useState } from "react";
import { useGroupChatRealtime } from "@/lib/use-group-chat-realtime";

// TEMPORARY — delete this whole file once the test passes.
// Replace with a real groupId you're a member of.
const TEST_GROUP_ID = "cmuca3ap80002u5gky9cvlfgz";

export default function RealtimeTestPage() {
  const [log, setLog] = useState<string[]>([]);

  useGroupChatRealtime(TEST_GROUP_ID, (message) => {
    setLog((prev) => [...prev, JSON.stringify(message)]);
  });

  useEffect(() => {
    console.log("Subscribed to realtime for group:", TEST_GROUP_ID);
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>Realtime test — group: {TEST_GROUP_ID}</h1>
      <p>Insert a row into the Message table in Supabase's Table Editor for this groupId, and watch this list.</p>
      <pre>{log.join("\n\n")}</pre>
    </div>
  );
}