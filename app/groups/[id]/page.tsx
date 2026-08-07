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
  const [error, setError] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [placeholderName, setPlaceholderName] = useState("");
  const [placeholderPhone, setPlaceholderPhone] = useState("");
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaidById, setEditPaidById] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState("EQUAL");
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  function loadGroup() {
    fetch(`/api/groups/${id}`).then((r) => r.json()).then((group) => {
      if (!group || !group.members) return;
      setMembers(group.members);
      if (group.members.length > 0) setPaidById(group.members[0].userId);
    });
  }

  async function loadPendingRequests() {
    const res = await fetch("/api/edit-permissions/pending");
    if (res.ok) setPendingRequests(await res.json());
  }

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => setCurrentUserId(me.userId));
    fetch(`/api/groups/${id}/expenses`).then((r) => r.json()).then(setExpenses);
    loadGroup();
  }, [id]);

  useEffect(() => {
    loadPendingRequests();
    const interval = setInterval(loadPendingRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  async function deleteExpense(expenseId: string) {
    if (!confirm("Delete this expense? Balances will recalculate.")) return;
    const res = await fetch(`/api/groups/${id}/expenses/${expenseId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    setExpenses(expenses.filter((e) => e.id !== expenseId));
  }

  async function saveEditExpense(expenseId: string) {
    const res = await fetch(`/api/groups/${id}/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editDesc,
        amountPaise: Math.round(parseFloat(editAmount) * 100),
        paidById: editPaidById,
      }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    const updated = await res.json();
    setExpenses(expenses.map((e) => (e.id === expenseId ? updated : e)));
    setEditingExpense(null);
  }

  async function generateInvite() {
    const res = await fetch(`/api/groups/${id}/invite`, { method: "POST" });
    const data = await res.json();
    setInviteLink(data.link);
  }

  async function addPlaceholder() {
    await fetch(`/api/groups/${id}/placeholder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: placeholderName, phone: placeholderPhone }),
    });
    setPlaceholderName("");
    setPlaceholderPhone("");
    setShowPlaceholder(false);
    loadGroup();
  }

  async function addExpense(confirmDuplicate = false) {
    setError(null);
    const amountPaise = Math.round(parseFloat(amount) * 100);

    const exactAmounts = expenseSplitType === "EXACT"
      ? Object.fromEntries(Object.entries(exactInputs).map(([uid, v]) => [uid, Math.round(parseFloat(v) * 100)]))
      : undefined;

    const percentages = expenseSplitType === "PERCENTAGE"
      ? Object.fromEntries(Object.entries(percentInputs).map(([uid, v]) => [uid, parseFloat(v)]))
      : undefined;

    const shareUnits = expenseSplitType === "SHARES"
      ? Object.fromEntries(
        Object.entries(shareInputs)
          .filter(([, v]) => v)
          .map(([uid, v]) => [uid, parseInt(v)])
      )
      : undefined;

    const res = await fetch(`/api/groups/${id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        amountPaise,
        paidById,
        splitType: expenseSplitType,
        exactAmounts,
        percentages,
        shareUnits,
        confirmDuplicate,
      }),
    });

    if (res.status === 409) {
      const data = await res.json();
      setWarning(data.message);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add expense");
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
    loadGroup();
  }

  async function requestEditPermission(expenseId: string, action: string) {
    const res = await fetch(`/api/groups/${id}/expenses/${expenseId}/request-edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.approved) {
      // Already approved — proceed with edit
      setEditingExpense(expenseId);
    } else {
      alert("Permission request sent to the expense creator. You can edit once they approve.");
    }
  }

  async function respondToRequest(permissionId: string, decision: "approved" | "denied") {
    const res = await fetch(`/api/edit-permissions/${permissionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Failed to respond");
      return;
    }
    loadPendingRequests();
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1>Group</h1>

      <Link href={`/groups/${id}/balances`}>View balances</Link>
      {" | "}
      <Link href={`/groups/${id}/settle`}>Settle up</Link>
      {" | "}
      <Link href={`/groups/${id}/recurring`}>Recurring expenses</Link>

      <h2>Members</h2>
      <ul>
        {members.map((m) => (
          <li key={m.userId}>
            {m.user.name || m.user.email}
            {m.userId === currentUserId && (
              <span style={{ color: "#888", fontSize: 12, marginLeft: 6 }}>(me)</span>
            )}
          </li>
        ))}
      </ul>
      <input
        placeholder="Member's email"
        value={memberEmail}
        onChange={(e) => setMemberEmail(e.target.value)}
      />
      <button onClick={addMember} disabled={!memberEmail}>Add member</button>
      {memberError && <p style={{ color: "red" }}>{memberError}</p>}

      <button onClick={generateInvite}>Generate invite link</button>
      {inviteLink && (
        <div style={{ marginTop: 8 }}>
          <input value={inviteLink} readOnly style={{ width: "100%" }} />
          <button onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy link</button>
          <p style={{ fontSize: 12, color: "#888" }}>
            Share this link — anyone with it can join. Valid 7 days.
          </p>
        </div>
      )}

      <button onClick={() => setShowPlaceholder(!showPlaceholder)}>Add placeholder member</button>
      {showPlaceholder && (
        <div>
          <input
            placeholder="Name (required)"
            value={placeholderName}
            onChange={(e) => setPlaceholderName(e.target.value)}
          />
          <input
            placeholder="Phone (optional)"
            value={placeholderPhone}
            onChange={(e) => setPlaceholderPhone(e.target.value)}
          />
          <button onClick={addPlaceholder} disabled={!placeholderName}>Add placeholder</button>
          <p style={{ fontSize: 12, color: "#888" }}>
            Placeholder members can be included in splits but can't log in.
            Useful for friends on trips who don't want to sign up.
          </p>
        </div>
      )}

      <h2>Add expense</h2>
      <input
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        placeholder="Amount (₹)"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <select value={paidById} onChange={(e) => setPaidById(e.target.value)}>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.user.name || m.user.email}
            {m.userId === currentUserId ? " (me)" : ""}
          </option>
        ))}
      </select>

      <select value={expenseSplitType} onChange={(e) => setExpenseSplitType(e.target.value)}>
        <option value="EQUAL">Split equally</option>
        <option value="EXACT">Exact amounts</option>
        <option value="PERCENTAGE">By percentage</option>
        <option value="SHARES">By shares</option>
      </select>

      {expenseSplitType === "EXACT" && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>Enter how much each person owes exactly:</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: ₹</label>
              <input
                type="number"
                placeholder="0"
                value={exactInputs[m.userId] || ""}
                onChange={(e) => setExactInputs({ ...exactInputs, [m.userId]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {expenseSplitType === "PERCENTAGE" && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>Enter what % each person owes (must total 100%):</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: </label>
              <input
                type="number"
                placeholder="0"
                value={percentInputs[m.userId] || ""}
                onChange={(e) => setPercentInputs({ ...percentInputs, [m.userId]: e.target.value })}
              />
              <span>%</span>
            </div>
          ))}
        </div>
      )}

      {expenseSplitType === "SHARES" && (
        <div>
          <p style={{ fontSize: 12, color: "#888" }}>Enter each person's share units (e.g. meals eaten):</p>
          {members.map((m) => (
            <div key={m.userId}>
              <label>{m.user.name || m.user.email}: </label>
              <input
                type="number"
                placeholder="0"
                value={shareInputs[m.userId] || ""}
                onChange={(e) => setShareInputs({ ...shareInputs, [m.userId]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <button onClick={() => addExpense(false)}>Add</button>

      {warning && (
        <div style={{ color: "orange" }}>
          {warning} <button onClick={() => addExpense(true)}>Add anyway</button>
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {pendingRequests.length > 0 && (
        <div style={{ border: "1px solid #444", padding: 12, marginTop: 16 }}>
          <h3>Pending permission requests</h3>
          {pendingRequests.map((req) => (
            <div key={req.id} style={{ marginBottom: 8 }}>
              {req.requestedBy.name || req.requestedBy.email} wants to {req.action}{" "}
              "{req.expense.description}"
              <button onClick={() => respondToRequest(req.id, "approved")} style={{ marginLeft: 8 }}>
                Approve
              </button>
              <button onClick={() => respondToRequest(req.id, "denied")} style={{ marginLeft: 4 }}>
                Deny
              </button>
            </div>
          ))}
        </div>
      )}

      <h2>Expenses</h2>
      <ul>
        {expenses.map((e) => (
          <li key={e.id}>
            {editingExpense === e.id ? (
              <div>
                <input value={editDesc} onChange={(ev) => setEditDesc(ev.target.value)} />
                <input
                  type="number"
                  value={editAmount}
                  onChange={(ev) => setEditAmount(ev.target.value)}
                />
                <select
                  value={editPaidById}
                  onChange={(ev) => setEditPaidById(ev.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name || m.user.email}
                    </option>
                  ))}
                </select>
                <button onClick={() => saveEditExpense(e.id)}>Save</button>
                <button onClick={() => setEditingExpense(null)}>Cancel</button>
              </div>
            ) : (
              <div>
                {e.description} — ₹{(e.amountPaise / 100).toFixed(2)}
                {e.paidById === currentUserId ? (
                  // Owner — can edit/delete freely
                  <>
                    <button onClick={() => {
                      setEditingExpense(e.id);
                      setEditDesc(e.description);
                      setEditAmount((e.amountPaise / 100).toString());
                      setEditPaidById(e.paidById);
                    }}>Edit</button>
                    <button onClick={() => deleteExpense(e.id)}>Delete</button>
                  </>
                ) : (
                  // Not owner — must request permission
                  <button onClick={() => requestEditPermission(e.id, "edit")}>
                    Request edit permission
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}