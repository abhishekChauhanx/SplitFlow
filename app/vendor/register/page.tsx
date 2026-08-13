"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VendorRegisterPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("mess");
  const [upiId, setUpiId] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function register() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, businessType, upiId, panNumber }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Registration failed");
        return;
      }
      router.push("/vendor/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 16px" }}>
      <h1>Set up your vendor account</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        For mess vendors, landlords, and anyone who collects recurring payments from a group.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          Business / Mess name
        </label>
        <input
          placeholder="e.g. Sharma Mess, Green Valley Apartments"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          Type
        </label>
        <select
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="mess">Mess / Tiffin service</option>
          <option value="landlord">Landlord / PG owner</option>
          <option value="society">Housing society</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          Your UPI ID (where tenants/subscribers pay you)
        </label>
        <input
          placeholder="e.g. sharma@okhdfcbank"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
          PAN number (optional — needed for HRA receipts above ₹1L/year)
        </label>
        <input
          placeholder="e.g. ABCDE1234F"
          value={panNumber}
          onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
          maxLength={10}
          style={{ width: "100%", fontFamily: "monospace", letterSpacing: 2 }}
        />
      </div>

      {error && <p style={{ color: "#f87171", marginBottom: 12 }}>{error}</p>}

      <button
        onClick={register}
        disabled={!businessName || loading}
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "10px 20px",
          fontSize: 14,
          cursor: "pointer",
          width: "100%",
        }}
      >
        {loading ? "Setting up..." : "Create vendor account"}
      </button>
    </div>
  );
}