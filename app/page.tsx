"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import "./home.css";

const FEATURES = [
  {
    title: "Create a group",
    description: "Spin up a group for a trip, flat, or friend circle in seconds.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    ),
  },
  {
    title: "Add expenses",
    description: "Split equally, by exact amount, percentage, or shares.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
  {
    title: "Settle up",
    description: "See who owes what at a glance, and settle with one tap.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    ),
  },
];

export default function Home() {
  const [me, setMe] = useState<{ name?: string; email?: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) setMe(await res.json());
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  return (
    <div className="flex min-h-screen flex-col bg-black font-sans text-white antialiased">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="hero-grid" />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-28 pt-28 text-center sm:pt-36">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Now with recurring expenses
          </span>

          <h1 className="text-gradient max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl sm:leading-tight">
            Split expenses with your groups, without the spreadsheet headache.
          </h1>

          <p className="mt-6 max-w-xl text-balance text-base leading-7 text-zinc-400 sm:text-lg">
            Create a group, add your friends, and keep track of who owes what
            — all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            {!checkingAuth && me ? (
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
              >
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
                >
                  Get started — it's free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/5"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="relative border-t border-white/10 bg-zinc-950">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-6 py-20 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200">
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
              <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
              <p className="text-sm leading-6 text-zinc-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}