"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function GroupDetailPage() {
  const { id } = useParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);

  function loadGroup() {
    fetch(`/api/groups/${id}`).then((r) => r.json()).then((group) => {
      setMembers(group.members);
      if (group.members.length > 0) setPaidById(group.members[0].userId);
    });
  }

  useEffect(() => {
    fetch(`/api/groups/${id}/expenses`).then((r) => r.json()).then(setExpenses);
    loadGroup();
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

  async function addMember() {
    setMemberError(null);
    const res = await fetch(`/api/groups/${id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMemberError(data.error || "Couldn't add member");
      return;
    }
    setMemberEmail("");
    loadGroup(); // refresh member list so the dropdown updates immediately
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1>Group</h1>

<Link href={`/groups/${id}/balances`}>View balances</Link>
{" | "}
<Link href={`/groups/${id}/settle`}>Settle up</Link>
      <h2>Members</h2>
      <ul>
        {members.map((m) => (
          <li key={m.userId}>{m.user.name || m.user.email}</li>
        ))}
      </ul>
      <input
        placeholder="Member's email"
        value={memberEmail}
        onChange={(e) => setMemberEmail(e.target.value)}
      />
      <button onClick={addMember} disabled={!memberEmail}>Add member</button>
      {memberError && <p style={{ color: "red" }}>{memberError}</p>}

      <h2>Add expense</h2>
      <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input placeholder="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <select value={paidById} onChange={(e) => setPaidById(e.target.value)}>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.user.name || m.user.email}
          </option>
        ))}
      </select>

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