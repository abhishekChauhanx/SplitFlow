"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

type Me = { name?: string; email?: string } | null;

type AuthContextValue = {
  me: Me;
  /** True until the first /api/me response comes back. */
  checkingAuth: boolean;
  /** Re-fetch /api/me — call after login/logout so the whole app updates. */
  refreshMe: () => Promise<void>;
  /** Optimistically clear auth state (e.g. right after logout) without
   *  waiting on a re-fetch. */
  clearMe: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      setMe(res.ok ? await res.json() : null);
    } catch {
      setMe(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  const clearMe = useCallback(() => setMe(null), []);

  // Guards only the automatic initial fetch below against React Strict
  // Mode's dev-only double-invoke of effects — it does NOT limit refreshMe()
  // itself, which still runs normally whenever called explicitly (e.g. after
  // login/logout). In production this ref is irrelevant since the effect
  // only ever runs once anyway.
  const didInitialFetch = useRef(false);

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    refreshMe();
  }, [refreshMe]);

  const value = useMemo(
    () => ({ me, checkingAuth, refreshMe, clearMe }),
    [me, checkingAuth, refreshMe, clearMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}