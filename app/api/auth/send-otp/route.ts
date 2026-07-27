import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/brevo";
import { saveOtp } from "@/lib/otp-store";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

try {
  saveOtp(email, otp);
  await sendOtpEmail(email, otp);

  return NextResponse.json({ ok: true });

} catch (error) {
  console.error("Send OTP Error:", error);

  return NextResponse.json(
    {
      error: "Failed to send OTP",
      message: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}
}