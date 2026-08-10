"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the `next` param — where to go after onboarding completes
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

      // If we came from an invite link, go back there after onboarding
      router.push(next || "/dashboard");
    } catch {
      setError("Couldn't save your details. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 16px" }}>
      <SFLoaderOverlay visible={loading} label="Saving your details" />

      <h1>Tell us about you</h1>
      {next && (
        <p style={{ color: "#888", fontSize: 13 }}>
          Complete your profile to join the group.
        </p>
      )}
      <input
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="tel"
        placeholder="Phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        type="text"
        placeholder="UPI ID (e.g. name@okhdfcbank)"
        value={upiId}
        onChange={(e) => setUpiId(e.target.value)}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !name}
      >
        {loading ? "Saving..." : "Continue"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}