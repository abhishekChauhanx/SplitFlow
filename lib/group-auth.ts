import { prisma } from "@/lib/prisma";

export class GroupAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function assertGroupMember(userId: string | null, groupId: string) {
  if (!userId) throw new GroupAccessError(401, "Not authenticated");

  const membership = await prisma.groupMember.findFirst({
    where: { userId, groupId },
  });

  if (!membership) throw new GroupAccessError(404, "Group not found");
  return membership;
}

export function handleGroupError(err: unknown) {
  const { NextResponse } = require("next/server");
  if (err instanceof GroupAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}