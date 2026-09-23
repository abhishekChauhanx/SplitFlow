"use client";

import { useState, useRef } from "react";
import EmojiPicker from "@/components/chat/EmojiPicker";
import MentionAutocomplete from "@/components/chat/MentionAutocomplete";

type Member = { userId: string; user: { name: string | null; email: string | null } };

// Matches @[Display Name](userId) tokens stored in the raw body
const MENTION_TOKEN = /@\[([^\]]+)\]\(([^)]+)\)/g;

// For the OUTGOING message body — always uses the real name, even for self-mentions,
// so other people in the chat see "@Abhishek Chauhan", never "@Me".
function tokensToPlainText(text: string) {
  return text.replace(MENTION_TOKEN, (_match, name) => `@${name}`);
}

// For what's shown INSIDE the composer textarea only — shows "@Me" for the
// current user's own mention token, so you see it the way you'd expect while typing.
function tokensToDisplayText(text: string, currentUserId?: string | null) {
  return text.replace(MENTION_TOKEN, (_match, name, id) =>
    id === currentUserId ? "@Me" : `@${name}`
  );
}

export default function MessageComposer({
  onSend,
  onTyping,
  members = [],
  currentUserId,
  disabled,
}: {
  onSend: (body: string, mentionIds: string[]) => void;
  onTyping?: () => void;
  members?: Member[];
  currentUserId?: string | null;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(""); // stores raw text WITH @[Name](id) tokens
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const MAX = 2000;

  // Derive mentionIds fresh from whatever tokens still exist in the text —
  // if the user deletes/edits a mention, it naturally drops out here.
  function deriveMentionIds(text: string): string[] {
    const ids = new Set<string>();
    for (const match of text.matchAll(MENTION_TOKEN)) {
      ids.add(match[2]);
    }
    return Array.from(ids);
  }

  function submit() {
    if (disabled) return;
    const mentionIds = deriveMentionIds(value);
    const displayBody = tokensToPlainText(value).trim(); // real names, always — for storage/sending
    if (!displayBody) return;
    onSend(displayBody, mentionIds);
    setValue("");
    setMentionQuery(null);
    ref.current?.focus();
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setValue(text);
    onTyping?.();

    const cursor = e.target.selectionStart;
    const upToCursor = text.slice(0, cursor);
    // Capped: single word, or two words max — prevents the popover eating the rest of the sentence
    const match = upToCursor.match(/@([a-zA-Z0-9_]*(?:\s[a-zA-Z0-9_]+)?)$/);

    setMentionQuery(match ? match[1] : null);
    setActiveIndex(0);
  }

  function getFiltered() {
    if (mentionQuery === null) return [];
    return members.filter((m) => {
      const name = (m.user.name || m.user.email || "").toLowerCase();
      return name.includes(mentionQuery.toLowerCase());
    });
  }

  function selectMention(member: Member) {
    const realName = member.user.name || member.user.email || "user";
    // Token always stores the real name (so the stored/sent message body is correct
    // for everyone else); only the textarea's rendered text shows "@Me" for yourself.
    const cursor = ref.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const token = `@[${realName}](${member.userId}) `;
    const replaced = upToCursor.replace(/@([a-zA-Z0-9_]*(?:\s[a-zA-Z0-9_]+)?)$/, token);
    const newValue = replaced + value.slice(cursor);

    setValue(newValue);
    setMentionQuery(null);
    ref.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const filtered = getFiltered();

    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filtered[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-composer-wrap">
      {mentionQuery !== null && (
        <MentionAutocomplete
          members={members}
          query={mentionQuery}
          activeIndex={activeIndex}
          currentUserId={currentUserId}
          onSelect={selectMention}
        />
      )}

      <div className="chat-composer">
        <EmojiPicker onSelect={(emoji) => setValue((v) => v + emoji)} />

        <textarea
          ref={ref}
          rows={1}
          value={tokensToDisplayText(value, currentUserId)}
          maxLength={MAX}
          placeholder="Write a message… use @ to mention"
          className="chat-composer-input"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        <button className="chat-send-btn" onClick={submit} disabled={!value.trim() || disabled}>
          Send
        </button>
      </div>
    </div>
  );
}