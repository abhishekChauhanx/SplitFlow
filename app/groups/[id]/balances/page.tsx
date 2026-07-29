"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function BalancesPage() {
  const { id } = useParams();
  const [balances, setBalances] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/groups/${id}/balances`).then((r) => r.json()).then(setBalances);
  }, [id]);

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1>Balances</h1>
      <ul>
        {balances.map((b) => (
          <li key={b.userId}>
            {b.name}: {b.netPaise >= 0 ? "is owed" : "owes"} ₹{Math.abs(b.netPaise / 100).toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}