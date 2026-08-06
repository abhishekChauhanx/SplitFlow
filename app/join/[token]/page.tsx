"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinPage() {
  const { token } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "error" | "done">("loading");
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
        setError("Couldn't load invite details. Check your connection.");
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
    setError("Unexpected response from server. Try again.");
    setStatus("error");
    return;
  }

  // Not logged in → send to login, then back here after
  if (res.status === 401) {
    router.push(`/login?from=/join/${token}`);
    return;
  }

  if (!res.ok) {
    setError(data.error || data.message || "Couldn't join group");
    setStatus("error");
    return;
  }

  setStatus("done");
  setTimeout(() => router.push(`/groups/${data.groupId}`), 1500);
}

  if (status === "loading") {
    return <p style={{ textAlign: "center", marginTop: 80 }}>Checking invite...</p>;
  }

  if (status === "error") {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={() => router.push("/login")}>Go to login</button>
      </div>
    );
  }

  if (status === "done") {
    return <p style={{ textAlign: "center", marginTop: 80 }}>Joined! Redirecting to group...</p>;
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
      <h1>You've been invited to join</h1>
      <h2>{groupName}</h2>
      <button
        onClick={join}
        disabled={status === "joining"}
        style={{ marginTop: 16 }}
      >
        {status === "joining" ? "Joining..." : "Join group"}
      </button>
    </div>
  );
}