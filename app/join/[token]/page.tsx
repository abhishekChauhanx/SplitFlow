"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";
import "../../home.css";
import "./join.css";

export default function JoinPage() {
  const { token } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "error">("loading");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setStatus("error");
          return;
        }
        setGroupName(data.groupName);
        setStatus("ready");
      })
      .catch(() => {
        setError("Couldn't load invite details.");
        setStatus("error");
      });
  }, [token]);

  async function join() {
    setStatus("joining");
    const res = await fetch(`/api/join/${token}`, { method: "POST" });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      setError("Unexpected response from server.");
      setStatus("error");
      return;
    }

    // Not logged in → go to login, come back here after
    if (res.status === 401) {
      router.push(`/login?from=/join/${token}`);
      return;
    }

    // Already a member → alert and redirect
    if (res.status === 409) {
      alert(`You're already a member of ${groupName}! Redirecting you there.`);
      router.replace(`/groups/${data.groupId}`);
      return;
    }

    if (!res.ok) {
      setError(data.error || "Couldn't join group");
      setStatus("error");
      return;
    }

    // Successfully joined → go to group
    router.replace(`/groups/${data.groupId}`);
  }

  if (status === "error") {
    return (
      <div className="join-page">
        <div className="hero-glow" />
        <div className="hero-grid" />
        <div className="join-error-card">
          <p className="join-error-text">{error}</p>
          <button onClick={() => router.push("/login")} className="join-error-btn">
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="hero-glow" />
      <div className="hero-grid" />

      <SFLoaderOverlay
        visible={status === "loading" || status === "joining"}
        label={status === "joining" ? `Joining ${groupName}` : "Checking invite"}
      />

      {status === "ready" && (
        <div className="join-card">
          <p className="join-eyebrow">You've been invited to join</p>
          <h1 className="text-gradient join-group-name">{groupName}</h1>
          <button onClick={join} className="join-btn">
            Join group
          </button>
        </div>
      )}
    </div>
  );
}