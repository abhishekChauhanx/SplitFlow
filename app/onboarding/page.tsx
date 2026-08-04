"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push("/dashboard");
    } catch {
      setError("Couldn't save your details. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 16px" }}>
      <h1>Tell us about you</h1>
      <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input type="text" placeholder="UPI ID (e.g. name@okhdfcbank)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
      <button onClick={handleSubmit} disabled={loading || !name || !phone}>
        {loading ? "Saving..." : "Continue"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}