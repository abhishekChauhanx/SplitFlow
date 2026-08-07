import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOtp } from "@/lib/otp-store";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { email, otp, from } = await req.json();

  const isValid = await checkOtp(email, otp);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({ data: { email } });
  }

  await createSession(user.id);

  // New user coming from an invite link
  // → go to onboarding first, then back to join page after
  if (isNewUser && from) {
    return NextResponse.json({ redirectTo: `/onboarding?next=${encodeURIComponent(from)}` });
  }

  // Existing user coming from an invite link → skip onboarding, go back to join page
  if (from) {
    return NextResponse.json({ redirectTo: from });
  }

  // Normal flow
  if (!user.name) {
    return NextResponse.json({ redirectTo: "/onboarding" });
  }

  return NextResponse.json({ redirectTo: "/dashboard" });
}