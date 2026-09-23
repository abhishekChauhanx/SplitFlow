"use client";

export default function MentionAutocomplete({
  members,
  query,
  activeIndex,
  currentUserId,
  onSelect,
}: {
  members: { userId: string; user: { name: string | null; email: string | null } }[];
  query: string;
  activeIndex: number;
  currentUserId?: string | null;
  onSelect: (member: { userId: string; user: { name: string | null; email: string | null } }) => void;
}) {
  const filtered = members.filter((m) => {
    const name = (m.user.name || m.user.email || "").toLowerCase();
    return name.includes(query.toLowerCase());
  });

  if (filtered.length === 0) return null;

  return (
    <div className="chat-mention-popover">
      {filtered.map((m, i) => {
        const isMe = m.userId === currentUserId;
        const displayName = isMe ? "Me" : m.user.name || m.user.email;

        return (
          <button
            key={m.userId}
            type="button"
            className={`chat-mention-option${i === activeIndex ? " active" : ""}`}
            onClick={() => onSelect(m)}
          >
            <span className="chat-mention-avatar">
              {(m.user.name || m.user.email || "?")[0].toUpperCase()}
            </span>
            {displayName}
          </button>
        );
      })}
    </div>
  );
}