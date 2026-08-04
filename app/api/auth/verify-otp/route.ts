import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkOtp } from "@/lib/otp-store";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();

  const isValid = await checkOtp(email, otp);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Brand new email — never seen before
    user = await prisma.user.create({ data: { email } });
    await createSession(user.id);
    return NextResponse.json({ redirectTo: "/onboarding" });
  }

  // Email already exists in the DB — skip onboarding entirely, even if
  // name/phone were never filled in
  await createSession(user.id);
  return NextResponse.json({ redirectTo: "/dashboard" });
}