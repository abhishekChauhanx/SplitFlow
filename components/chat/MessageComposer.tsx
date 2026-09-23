"use client";

import { useState, useRef } from "react";
import EmojiPicker from "@/components/chat/EmojiPicker";

export default function MessageComposer({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (body: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const MAX = 2000;

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    ref.current?.focus();
  }

  return (
    <div className="chat-composer">
      <EmojiPicker onSelect={(emoji) => setValue((v) => v + emoji)} />

      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX}
        placeholder="Write a message…"
        className="chat-composer-input"
        onChange={(e) => {
          setValue(e.target.value);
          onTyping?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />

      <button className="chat-send-btn" onClick={submit} disabled={!value.trim() || disabled}>
        Send
      </button>
    </div>
  );
}