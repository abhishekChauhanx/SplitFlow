import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { createSession } from "@/lib/session";



export async function POST(req: NextRequest) {
  const { idToken } = await req.json();

  let phone: string;
  try {
    phone = await verifyFirebaseIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    user = await prisma.user.create({ data: { phone } });
    await createSession(user.id);
    return NextResponse.json({ redirectTo: "/onboarding" });
  }

  await createSession(user.id);

  if (!user.name || !user.email) {
    return NextResponse.json({ redirectTo: "/onboarding" });
  }

  return NextResponse.json({ redirectTo: "/dashboard" });
}