"use client";

import { useState, useEffect } from "react";

export default function PushNotificationButton() {
  // Start with null — means "not yet determined"
  // This ensures server and client render the same thing initially (nothing)
  const [mounted, setMounted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only runs on client — safe to check browser APIs here
    setMounted(true);

    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    }).catch(() => {});
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setSubscribed(true);
      setPermission("granted");
    } catch (err) {
      console.error("Push subscription failed:", err);
      if ("Notification" in window) setPermission(Notification.permission);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }

  // KEY FIX: render nothing until client has mounted
  // This makes server and client initial render identical → no hydration mismatch
  if (!mounted) return null;

  // Browser doesn't support notifications
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }

  // User blocked notifications — can't ask again
  if (permission === "denied") {
    return (
      <p style={{ fontSize: 12, color: "#888" }}>
        Notifications blocked — enable them in your browser settings.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {subscribed ? (
        <>
          <span style={{ fontSize: 12, color: "#86efac" }}>🔔 Notifications on</span>
          <button
            onClick={unsubscribe}
            disabled={loading}
            style={{
              fontSize: 12,
              color: "#888",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {loading ? "..." : "Turn off"}
          </button>
        </>
      ) : (
        <button onClick={subscribe} disabled={loading} style={{ fontSize: 12 }}>
          {loading ? "Setting up..." : "🔔 Enable notifications"}
        </button>
      )}
    </div>
  );
}