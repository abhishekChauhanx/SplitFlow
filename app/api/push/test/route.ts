import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { sendPushToUser } from "@/lib/webpush";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test endpoint disabled in production" }, { status: 403 });
  }

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await sendPushToUser(userId, {
    title: "SplitFlow test notification",
    body: "Push notifications are working correctly 🎉",
    url: "/dashboard",
  });

  return NextResponse.json({ ok: true });
}