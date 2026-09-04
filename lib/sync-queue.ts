import { getQueuedExpenses, removeQueuedExpense } from "@/lib/offline-queue";

export async function syncQueuedExpenses(onExpenseSynced?: (groupId: string, expense: any) => void) {
  const queued = await getQueuedExpenses();
  if (queued.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  // Sync in order — important since later expenses in the same group may
  // depend on the split math being consistent with earlier ones.
  for (const item of queued) {
    try {
      const res = await fetch(`/api/groups/${item.groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item.payload, clientId: item.clientId }),
      });

      if (res.ok) {
        const expense = await res.json();
        await removeQueuedExpense(item.clientId);
        onExpenseSynced?.(item.groupId, expense);
        synced++;
      } else {
        // A real validation error (not a network failure) — don't keep
        // retrying forever, but don't silently lose it either. Leave it
        // queued so the user can see it failed and take action.
        failed++;
      }
    } catch {
      // Still offline or request genuinely failed to reach the server —
      // stop trying the rest for now, they'll retry on the next sync trigger.
      break;
    }
  }

  return { synced, failed };
}