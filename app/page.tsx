"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import "./home.css";

const FEATURES = [
  {
    title: "Split any way you like",
    description:
      "Equal, exact amounts, percentages, or usage-based shares — a restaurant bill and a mess bill don't split the same way.",
    accent: "indigo",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
  {
    title: "Settle with real UPI",
    description:
      "Every balance turns into a scannable QR code or a tap-to-pay link. No more \"I'll send it later.\"",
    accent: "sky",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    ),
  },
  {
    title: "Two-sided confirmation",
    description:
      "Both sides confirm before it's marked settled — with UTR proof and dispute resolution built in.",
    accent: "emerald",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    ),
  },
  {
    title: "Recurring bills, handled",
    description:
      "Rent, mess, tiffin — set it once. New roommates get included automatically, no manual re-splitting.",
    accent: "indigo",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    ),
  },
  {
    title: "HRA-ready rent receipts",
    description:
      "Auto-generated the moment a rent payment is confirmed, digitally signed by your landlord.",
    accent: "sky",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    ),
  },
  {
    title: "Trust that travels with you",
    description:
      "A reliability score built from real payment history — on-time confirmations, dispute rate, proof provided.",
    accent: "emerald",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
];

const STATS = [
  { value: "4", label: "split methods" },
  { value: "2-sided", label: "payment confirm" },
  { value: "0", label: "manual reconciliation" },
];

// Tailwind needs full, static class strings to detect them at build time —
// `bg-${accent}-50` would silently produce nothing. Hence the explicit map.
const ACCENT_STYLES: Record<string, string> = {
  indigo:
    "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
  sky:
    "border-sky-100 bg-sky-50 text-sky-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
  emerald:
    "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
};

export default function Home() {
  const { me, checkingAuth } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased transition-colors dark:bg-black dark:text-white">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="hero-grid" />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-24 pt-28 text-center sm:pt-36">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:shadow-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Built for how money actually moves in India
          </span>

          <h1 className="text-gradient max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl sm:leading-tight">
            Split expenses. Settle with real UPI.
          </h1>

          <p className="mt-6 max-w-xl text-balance text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
            Not another balance-tracker that ends in an awkward "did you pay
            me yet?" text. SplitFlow turns every debt into a real, verifiable
            UPI payment — with both sides confirming before it's done.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            {!checkingAuth && me ? (
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-full bg-indigo-600 px-7 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 dark:bg-white dark:text-black dark:shadow-none dark:hover:bg-zinc-200"
              >
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-indigo-600 px-7 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 dark:bg-white dark:text-black dark:shadow-none dark:hover:bg-zinc-200"
                >
                  Get started — it's free
                </Link>
                <Link
                  href="#features"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 px-7 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
                >
                  See how it works
                </Link>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="mt-16 flex justify-center gap-10 sm:gap-16">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{s.value}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="relative border-t border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-200/60 dark:border-white/10 dark:bg-zinc-900 dark:hover:shadow-black/40"
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full border shadow-sm dark:shadow-none ${ACCENT_STYLES[feature.accent]}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  {feature.icon}
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Secondary CTA band */}
      <section className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-10 text-center dark:border-white/10 dark:from-zinc-900 dark:to-black sm:p-14">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
              One less awkward conversation per trip.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              Groups, recurring rent, mess bills, farewell collections — all
              in one place, all settled with real money moving.
            </p>
            {!checkingAuth && me ? (
              <Link
                href="/dashboard"
                className="mt-8 inline-block rounded-full bg-zinc-900 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Go to your dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="mt-8 inline-block rounded-full bg-zinc-900 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Create your first group
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8 dark:border-white/10">
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-600">
          SplitFlow — built for splitting bills and settling with real UPI.
        </p>
      </footer>
    </div>
  );
}