const DB_NAME = "splitflow-offline";
const DB_VERSION = 2; // bumped from 1 — added the pending-messages store
const EXPENSE_STORE = "pending-expenses";
const MESSAGE_STORE = "pending-messages";

export interface QueuedExpense {
  clientId: string;
  groupId: string;
  payload: any; // the same body shape sent to POST /api/groups/[id]/expenses
  createdAt: number;
}

export interface QueuedMessage {
  clientId: string;
  groupId: string;
  body: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXPENSE_STORE)) {
        db.createObjectStore(EXPENSE_STORE, { keyPath: "clientId" });
      }
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        db.createObjectStore(MESSAGE_STORE, { keyPath: "clientId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------- Expenses (unchanged) ----------

export async function enqueueExpense(item: QueuedExpense): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSE_STORE, "readwrite");
    tx.objectStore(EXPENSE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedExpenses(): Promise<QueuedExpense[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSE_STORE, "readonly");
    const request = tx.objectStore(EXPENSE_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedExpense(clientId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPENSE_STORE, "readwrite");
    tx.objectStore(EXPENSE_STORE).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Messages (new) ----------

export async function enqueueMessage(item: QueuedMessage): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGE_STORE, "readwrite");
    tx.objectStore(MESSAGE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGE_STORE, "readonly");
    const request = tx.objectStore(MESSAGE_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedMessage(clientId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGE_STORE, "readwrite");
    tx.objectStore(MESSAGE_STORE).delete(clientId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Shared ----------

export function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}