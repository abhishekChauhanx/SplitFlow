"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import "../home.css"; // reuses .hero-glow / .hero-grid / .text-gradient from the home page

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("next")
    : null;

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/user/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, upiId }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      router.push(next || "/dashboard");
    } catch {
      setError("Couldn't save your details. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased transition-colors dark:bg-black dark:text-white">
      <Navbar />
      <SFLoaderOverlay visible={loading} label="Saving your details" />

      {/* Hero-style header, same glow/grid treatment as home */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="hero-grid" />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-16 pt-20 text-center sm:pt-28">
          {next && (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:shadow-none">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              Joining a group
            </span>
          )}

          <h1 className="text-gradient max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-tight">
            Tell us about you
          </h1>

          <p className="mt-4 max-w-sm text-balance text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base">
            {next
              ? "A few details and you're in — this is what your group will see and pay."
              : "Your name and UPI ID are how the rest of your group finds and pays you."}
          </p>
        </div>
      </section>

      {/* Form card, styled like the feature cards */}
      <section className="relative border-t border-zinc-200 bg-zinc-50 pb-24 dark:border-white/10 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-md px-6 pt-14">
          <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:shadow-none sm:p-8">
            <div className="flex flex-col gap-5">
              <Field label="Full name">
                <input
                  type="text"
                  placeholder="Ananya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses}
                />
              </Field>

              <Field label="Phone number">
                <input
                  type="tel"
                  placeholder="9**** *****"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClasses}
                />
              </Field>

              <Field label="UPI ID" hint="Used to generate your payment QR">
                <input
                  type="text"
                  placeholder="name@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className={inputClasses}
                />
              </Field>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !name}
                className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:shadow-none dark:hover:bg-zinc-200"
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputClasses =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/15 dark:bg-black dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-white/40 dark:focus:ring-white/20";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</span>
      )}
    </label>
  );
}