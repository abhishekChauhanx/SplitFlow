"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import Navbar from "@/components/Navbar";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("from")
    : null;

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
    } catch {
      setError("Couldn't send the code. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, from }), // pass from
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      router.push(data.redirectTo);
    } catch {
      setError("That code didn't match. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, action: () => void, disabled: boolean) {
    if (e.key === "Enter" && !disabled) action();
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 antialiased transition-colors dark:bg-black dark:text-white">
      <SFLoaderOverlay
        visible={loading}
        label={step === "email" ? "Sending code" : "Verifying code"}
      />

      {/* Reuses the same Navbar as every other page — "minimal" just hides
          the Log in/Sign up CTAs, which would be redundant here. Theme
          toggle, and bell/avatar if already authenticated, still show. */}
      <Navbar variant="minimal" />

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
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
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    {loading ? "Sending…" : "Send code"}
                  </button>
                </>
              )}

              {step === "otp" && (
                <>
                  <label htmlFor="otp" className="sr-only">
                    6-digit code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => handleKeyDown(e, handleVerifyOtp, loading || !otp)}
                    className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-center text-lg tracking-[0.5em] text-zinc-900 placeholder:tracking-normal placeholder:text-zinc-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || !otp}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    {loading ? "Verifying…" : "Verify"}
                  </button>

                  <button
                    onClick={() => {
                      setStep("email");
                      setOtp("");
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
            New here?{" "}
            <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-white dark:hover:text-zinc-300">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}