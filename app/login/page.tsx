"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { sendOtp, setupRecaptcha } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      if (!verifierRef.current) {
        verifierRef.current = setupRecaptcha("recaptcha-container");
      }
      confirmationRef.current = await sendOtp(phone, verifierRef.current);
      setStep("otp");
    } catch {
      setError("Couldn't send the code. Check the number and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);
    try {
      if (!confirmationRef.current) throw new Error("No OTP request in progress");
      const credential = await confirmationRef.current.confirm(otp);
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      router.push(data.redirectTo);
    } catch {
      setError("That code didn't match. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 16px" }}>
      <h1>Sign in</h1>

      {step === "phone" && (
        <>
          <input
            type="tel"
            placeholder="+91XXXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button onClick={handleSendOtp} disabled={loading || !phone}>
            {loading ? "Sending..." : "Send code"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <input
            type="text"
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button onClick={handleVerifyOtp} disabled={loading || !otp}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
      <div id="recaptcha-container" />
    </div>
  );
}