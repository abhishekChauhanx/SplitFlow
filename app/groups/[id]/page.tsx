"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function GroupDetailPage() {
  const { id } = useParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${id}/expenses`).then((r) => r.json()).then(setExpenses);
  }, [id]);

  async function addExpense(confirmDuplicate = false) {
    const amountPaise = Math.round(parseFloat(amount) * 100);
    const res = await fetch(`/api/groups/${id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amountPaise, paidById, confirmDuplicate }),
    });

    if (res.status === 409) {
      const data = await res.json();
      setWarning(data.message);
      return;
    }

    const expense = await res.json();
    setExpenses([expense, ...expenses]);
    setDescription("");
    setAmount("");
    setWarning(null);
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1>Group</h1>
      <Link href={`/groups/${id}/balances`}>View balances</Link>

      <h2>Add expense</h2>
      <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input placeholder="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input placeholder="Paid by (user id)" value={paidById} onChange={(e) => setPaidById(e.target.value)} />
      <button onClick={() => addExpense(false)}>Add</button>

      {warning && (
        <div style={{ color: "orange" }}>
          {warning} <button onClick={() => addExpense(true)}>Add anyway</button>
        </div>
      )}

      <h2>Expenses</h2>
      <ul>
        {expenses.map((e) => (
          <li key={e.id}>{e.description} — ₹{(e.amountPaise / 100).toFixed(2)}</li>
        ))}
      </ul>
    </div>
  );
}