import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Every group this user belongs to, plus their own last-read marker for it (if any)
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: {
      groupId: true,
      group: { select: { name: true } },
    },
  });

  if (memberships.length === 0) return NextResponse.json([]);

  const reads = await prisma.messageRead.findMany({
    where: { userId, groupId: { in: memberships.map((m) => m.groupId) } },
    select: { groupId: true, lastReadAt: true },
  });
  const lastReadByGroup = new Map(reads.map((r) => [r.groupId, r.lastReadAt]));

  // For each group, fetch messages sent by others, after the user's last-read
  // marker (or all messages if they've never read this group's chat at all),
  // excluding deleted ones. Capped per group so a very stale account doesn't
  // pull thousands of rows.
  const results = await Promise.all(
    memberships.map(async (m) => {
      const lastReadAt = lastReadByGroup.get(m.groupId);
      const messages = await prisma.message.findMany({
        where: {
          groupId: m.groupId,
          senderId: { not: userId },
          deletedAt: null,
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
        include: { sender: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return messages.map((msg) => ({
        id: msg.clientId,
        groupId: m.groupId,
        groupName: m.group.name,
        preview: msg.body.length > 60 ? msg.body.slice(0, 60) + "…" : msg.body,
        senderName: msg.sender.name || msg.sender.email || "Someone",
      }));
    })
  );

  return NextResponse.json(results.flat());
}