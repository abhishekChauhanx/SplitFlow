"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_SET = [
  "😀","😂","😍","😊","😎","🙌","👍","👎","🙏","👏",
  "❤️","🔥","🎉","😢","😡","🤔","😴","🥳","💀","✅",
  "❌","💯","🙈","😬","🤝","💰","🍕","☕","🎂","🚀",
];

export default function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="chat-emoji-wrap">
      <button
        type="button"
        className="chat-emoji-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Add emoji"
      >
        🙂
      </button>
      {open && (
        <div className="chat-emoji-popover">
          {EMOJI_SET.map((e) => (
            <button
              key={e}
              type="button"
              className="chat-emoji-option"
              onClick={() => {
                onSelect(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}