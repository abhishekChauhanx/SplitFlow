import { prisma } from "@/lib/prisma";

export async function saveOtp(email: string, otp: string) {
  await prisma.otpCode.deleteMany({ where: { email } });
  const created = await prisma.otpCode.create({
    data: {
      email,
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  console.log("Saved OTP:", created);
}

export async function checkOtp(email: string, otp: string): Promise<boolean> {
  const allForEmail = await prisma.otpCode.findMany({ where: { email } });
  console.log("All OTP rows for this email at verify time:", allForEmail);
  console.log("Looking for match with:", { email, otp });

  const entry = await prisma.otpCode.findFirst({
    where: { email, code: otp },
  });
  console.log("Matched entry:", entry);

  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    console.log("Entry expired at:", entry.expiresAt, "current time:", new Date());
    await prisma.otpCode.delete({ where: { id: entry.id } });
    return false;
  }
  await prisma.otpCode.delete({ where: { id: entry.id } });
  return true;
}