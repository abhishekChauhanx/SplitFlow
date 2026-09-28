"use client";

import { useEffect, useState } from "react";
import SFLogoAnimated from "@/components/SFLogoAnimated";
import "./SplashScreen.css";

const KEY = "sf-splash-seen";
const MIN_MS = 2100; // logo animation is 1.55s, plus a short hold
const MAX_MS = 6000; // never block the site longer than this
const FADE_MS = 450;

export default function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(KEY);
    } catch {}
    if (seen) {
      setPhase("gone");
      return;
    }

    let minDone = false;
    let loaded = document.readyState === "complete";
    let finished = false;
    const timers: number[] = [];

    function finish() {
      if (finished) return;
      finished = true;
      setPhase("leave");
      timers.push(
        window.setTimeout(() => {
          setPhase("gone");
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
        }, FADE_MS)
      );
    }

    function check() {
      if (minDone && loaded) finish();
    }

    timers.push(
      window.setTimeout(() => {
        minDone = true;
        check();
      }, MIN_MS)
    );
    timers.push(window.setTimeout(finish, MAX_MS));

    const onLoad = () => {
      loaded = true;
      check();
    };
    if (!loaded) window.addEventListener("load", onLoad);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("load", onLoad);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`sf-splash${phase === "leave" ? " sf-splash--leave" : ""}`}
      role="status"
      aria-label="Loading SplitFlow"
    >
      <SFLogoAnimated height={56} />
    </div>
  );
}