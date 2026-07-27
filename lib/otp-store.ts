// Simple in-memory store for OTPs. Fine for single-instance dev/small deployments.
// For production scale, swap this for a Postgres table or Redis.
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

export function saveOtp(email: string, otp: string) {
  otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min expiry
}

export function checkOtp(email: string, otp: string): boolean {
  const entry = otpStore.get(email);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return false;
  }
  const isValid = entry.otp === otp;
  if (isValid) otpStore.delete(email); // one-time use
  return isValid;
}