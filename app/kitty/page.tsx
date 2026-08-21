"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";

export default function KittyDashboardPage() {
  const [kitties, setKitties] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/kitty");
    if (res.ok) setKitties(await res.json());
  }, []);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.ok) setCurrentUserId((await res.json()).userId);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadMe()]);
  }, [load, loadMe]);

  useEffect(() => {
    refreshAll().finally(() => setInitialLoading(false));
  }, [refreshAll]);

  function statusBadge(status: string) {
    if (status === "collecting") return { bg: "#172554", text: "#60a5fa", label: "🟡 Collecting" };
    if (status === "closed") return { bg: "#1c1917", text: "#a8a29e", label: "⚪ Closed" };
    return { bg: "#14532d", text: "#86efac", label: "✓ Refunded" };
  }

  if (initialLoading) return <SFLoaderOverlay visible={true} label="Loading collection pools" />;

  const organizing = kitties.filter((k) => k.organizerId === currentUserId);
  const contributing = kitties.filter((k) => k.organizerId !== currentUserId);

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <BackButton href="/dashboard" />
          <h1 style={{ margin: 0, fontSize: 20 }}>Collection pools</h1>
          <RefreshButton onRefresh={refreshAll} label="Refreshing collection pools" />
        </div>
      </div>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Pool money together for gifts, events, or shared funds — track contributions and refund the leftover automatically.
      </p>

      <Link href="/kitty/new">
        <button style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 14, cursor: "pointer", marginBottom: 28, width: "100%" }}>
          + Start a new collection pool
        </button>
      </Link>

      {kitties.length === 0 && (
        <div style={{ padding: 24, background: "#1a1a1a", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#888", margin: 0 }}>
            No collection pools yet. Start one for a gift, farewell fund, or shared event cost.
          </p>
        </div>
      )}

      {organizing.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            You're organizing
          </h2>
          {organizing.map((k) => {
            const collected = k.contributions
              .filter((c: any) => c.status === "paid" || c.status === "confirmed")
              .reduce((sum: number, c: any) => sum + (c.paidAmountPaise || 0), 0);
            const pct = k.targetPaise > 0 ? Math.min(100, (collected / k.targetPaise) * 100) : 0;
            const badge = statusBadge(k.status);
            const notPaidCount = k.contributions.filter((c: any) => c.status === "pending").length;

            return (
              <Link key={k.id} href={`/kitty/${k.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontWeight: 600 }}>{k.title}</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                        ₹{(collected / 100).toFixed(0)} of ₹{(k.targetPaise / 100).toFixed(0)} collected
                        {notPaidCount > 0 && ` · ${notPaidCount} haven't paid yet`}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: badge.bg, color: badge.text, whiteSpace: "nowrap" }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ background: "#2a2a2a", borderRadius: 4, height: 6, marginTop: 10 }}>
                    <div style={{ background: "#60a5fa", borderRadius: 4, height: 6, width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </>
      )}

      {contributing.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 24 }}>
            You're contributing to
          </h2>
          {contributing.map((k) => {
            const myContribution = k.contributions.find((c: any) => c.userId === currentUserId);
            const badge = statusBadge(k.status);

            return (
              <Link key={k.id} href={`/kitty/${k.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 14, marginBottom: 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontWeight: 600 }}>{k.title}</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                        Organized by {k.organizer.name || k.organizer.email} · Your share: ₹{((myContribution?.amountPaise || 0) / 100).toFixed(0)}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: badge.bg, color: badge.text, whiteSpace: "nowrap" }}>
                      {badge.label}
                    </span>
                  </div>
                  {myContribution?.status === "pending" && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f59e0b" }}>⏳ You haven't contributed yet</p>
                  )}
                  {(myContribution?.status === "paid" || myContribution?.status === "confirmed") && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#86efac" }}>
                      ✓ You've contributed ₹{((myContribution?.paidAmountPaise || 0) / 100).toFixed(0)}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </>
      )}
    </div>
  );
}