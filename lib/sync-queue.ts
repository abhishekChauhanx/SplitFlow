import {
  getQueuedExpenses,
  removeQueuedExpense,
  getQueuedMessages,
  removeQueuedMessage,
} from "@/lib/offline-queue";

export async function syncQueuedExpenses(onExpenseSynced?: (groupId: string, expense: any) => void) {
  const queued = await getQueuedExpenses();
  if (queued.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

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
        failed++;
      }
    } catch {
      break;
    }
  }

  return { synced, failed };
}

export async function syncQueuedMessages(onMessageSynced?: (groupId: string, message: any) => void) {
  const queued = await getQueuedMessages();
  if (queued.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      const res = await fetch(`/api/groups/${item.groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: item.body,
          clientId: item.clientId,
          mentionIds: [],
        }),
      });

      if (res.ok) {
        const message = await res.json();
        await removeQueuedMessage(item.clientId);
        onMessageSynced?.(item.groupId, message);
        synced++;
      } else {
        failed++;
      }
    } catch {
      break;
    }
  }

  return { synced, failed };
}