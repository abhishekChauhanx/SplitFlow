import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/brevo";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.isDeleted) return NextResponse.json({ error: "Account already deleted" }, { status: 409 });

  // Capture BEFORE nulling out
  const userEmail = user.email;
  const userName = user.name;

  // Soft delete
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: null,
      name: "Deleted User",
      phone: null,
      upiId: null,
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  await prisma.pushSubscription.deleteMany({ where: { userId } });

  if (userEmail) {
    await prisma.otpCode.deleteMany({ where: { email: userEmail } });
  }

  // Send confirmation email
  if (userEmail) {
    try {
      await sendEmail({
        to: userEmail,
        subject: "Your SplitFlow account has been deleted",
        text: `Hi ${userName || "there"}, your SplitFlow account has been permanently deleted.`,
        html: `
          <p>Hi ${userName || "there"},</p>
          <p>Your SplitFlow account has been permanently deleted as requested.</p>
          <p><strong>What was removed:</strong></p>
          <ul>
            <li>Your email address</li>
            <li>Your name, phone number, and UPI ID</li>
            <li>Your push notification subscriptions</li>
          </ul>
          <p><strong>What was kept</strong> (for group financial integrity):</p>
          <ul>
            <li>Expense records — shown as "Deleted User"</li>
            <li>Settlement records — amounts and statuses preserved</li>
          </ul>
          <p>If you did not request this, please contact us immediately at ${process.env.BREVO_SENDER_EMAIL}</p>
          <p>— SplitFlow</p>
        `,
      });
    } catch (err: any) {
      console.error("Delete confirmation email failed:");
      console.error("Code:", err.code);
      console.error("Response:", err.response);
      console.error("Message:", err.message);
    }
  }

  const cookieStore = await cookies();
  cookieStore.delete("session");

  return NextResponse.json({ ok: true });
}