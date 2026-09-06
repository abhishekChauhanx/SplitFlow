"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  /** What the user picked: "system", "light", or "dark". */
  preference: ThemePreference;
  /** What's actually applied right now (system resolved to light/dark). */
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  /** Convenience: cycles light -> dark -> system -> light. */
  toggleTheme: () => void;
};

const STORAGE_KEY = "theme-preference";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeClass(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline script in layout.tsx already set the correct class before
  // hydration, and also stashed the resolved values on window so our first
  // render here matches the DOM exactly (avoids a hydration flash/mismatch).
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    return (window as any).__themePreference ?? "system";
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "light";
    return (window as any).__resolvedTheme ?? getSystemTheme();
  });

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);

    const next = pref === "system" ? getSystemTheme() : pref;
    setResolvedTheme(next);
    applyThemeClass(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(
      preference === "light" ? "dark" : preference === "dark" ? "system" : "light"
    );
  }, [preference, setPreference]);

  // Keep in sync with OS-level changes while preference === "system".
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange(e: MediaQueryListEvent) {
      if (preference !== "system") return;
      const next: ResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyThemeClass(next);
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [preference]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference, toggleTheme }),
    [preference, resolvedTheme, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}