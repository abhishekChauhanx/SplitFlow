"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import Navbar from "@/components/Navbar";
import "../home.css";

const OTP_LENGTH = 6;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const from = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("from")
    : null;

  const otp = otpDigits.join("");

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStep("otp");
      // Focus the first OTP box the moment the boxes render
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch {
      setError("Couldn't send the code. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(codeOverride?: string) {
    const codeToVerify = codeOverride ?? otp;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: codeToVerify, from }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      router.push(data.redirectTo);
    } catch {
      setError("That code didn't match. Try again.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, action: () => void, disabled: boolean) {
    if (e.key === "Enter" && !disabled) action();
  }

  // ── Single-box OTP logic ──

  function handleDigitChange(index: number, value: string) {
    // Only accept a single digit per box
    const digit = value.replace(/\D/g, "").slice(-1);

    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit the instant all 6 boxes are filled
    const fullCode = next.join("");
    if (fullCode.length === OTP_LENGTH && next.every((d) => d !== "")) {
      handleVerifyOtp(fullCode);
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        // Clear current box first
        const next = [...otpDigits];
        next[index] = "";
        setOtpDigits(next);
      } else if (index > 0) {
        // Empty already — jump back and clear the previous box
        inputRefs.current[index - 1]?.focus();
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter" && otp.length === OTP_LENGTH) {
      handleVerifyOtp();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);

    const lastFilledIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputRefs.current[lastFilledIndex]?.focus();

    if (pasted.length === OTP_LENGTH) {
      handleVerifyOtp(pasted);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white text-zinc-900 antialiased transition-colors dark:bg-black dark:text-white">
      <div className="hero-glow" />
      <div className="hero-grid" />

      <SFLoaderOverlay
        visible={loading}
        label={step === "email" ? "Sending code" : "Verifying code"}
      />

      <Navbar variant="minimal" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 text-sm font-bold text-white shadow-sm">
              SF
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
            <h1 className="text-gradient text-xl font-semibold tracking-tight">
              {step === "email" ? "Sign in" : "Check your email"}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {step === "email"
                ? "We'll email you a one-time code — no password needed."
                : <>Enter the 6-digit code we sent to <span className="font-medium text-zinc-700 dark:text-zinc-200">{email}</span>.</>}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {step === "email" && (
                <>
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleSendOtp, loading || !email)}
                    className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !email}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-sky-500 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition hover:shadow-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:from-white dark:to-white dark:text-black dark:shadow-none"
                  >
                    {loading ? "Sending…" : "Send code"}
                  </button>
                </>
              )}

              {step === "otp" && (
                <>
                  {/* Single-box OTP — 6 individual digit inputs, auto-advancing,
                      auto-submitting once all are filled, paste-friendly. */}
                  <div className="flex justify-between gap-2" onPaste={handlePaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                        className="h-13 w-12 rounded-lg border border-zinc-300 bg-white text-center text-xl font-semibold text-zinc-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                        style={{ height: 52 }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleVerifyOtp()}
                    disabled={loading || otp.length !== OTP_LENGTH}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-sky-500 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition hover:shadow-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:from-white dark:to-white dark:text-black dark:shadow-none"
                  >
                    {loading ? "Verifying…" : "Verify"}
                  </button>

                  <button
                    onClick={() => {
                      setStep("email");
                      setOtpDigits(Array(OTP_LENGTH).fill(""));
                      setError(null);
                    }}
                    disabled={loading}
                    className="text-center text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Use a different email
                  </button>
                </>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            New here? Just enter your email above — your account is created automatically.
          </p>
        </div>
      </main>
    </div>
  );
}