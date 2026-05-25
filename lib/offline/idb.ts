import type { IDBPDatabase } from "idb";

import { openDB } from "idb";

import type { PendingOp, PushSettings } from "./operation-types";

const DB_NAME = "wanderlog";
const DB_VERSION = 1;

type WLSchema = {
  pending_operations: { key: string; value: PendingOp; indexes: { byCreatedAt: number; byStatus: string } };
  photo_blobs: { key: string; value: Blob };
  push_settings: { key: "settings"; value: PushSettings };
};

let dbPromise: Promise<IDBPDatabase<WLSchema>> | null = null;

export function openWanderlogDB() {
  if (!dbPromise) {
    dbPromise = openDB<WLSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending_operations")) {
          const store = db.createObjectStore("pending_operations", { keyPath: "opId" });
          store.createIndex("byCreatedAt", "createdAt");
          store.createIndex("byStatus", "status");
        }
        if (!db.objectStoreNames.contains("photo_blobs")) {
          db.createObjectStore("photo_blobs");
        }
        if (!db.objectStoreNames.contains("push_settings")) {
          db.createObjectStore("push_settings");
        }
      },
    });
  }
  return dbPromise;
}

export async function putOperation(op: PendingOp) {
  const db = await openWanderlogDB();
  await db.put("pending_operations", op);
}

export async function listOperations(): Promise<PendingOp[]> {
  const db = await openWanderlogDB();
  return db.getAllFromIndex("pending_operations", "byCreatedAt");
}

export async function getOperation(opId: string): Promise<PendingOp | undefined> {
  const db = await openWanderlogDB();
  return db.get("pending_operations", opId);
}

export async function removeOperation(opId: string) {
  const db = await openWanderlogDB();
  await db.delete("pending_operations", opId);
}

export async function updateOperationStatus(opId: string, patch: Partial<PendingOp>) {
  const db = await openWanderlogDB();
  const existing = await db.get("pending_operations", opId);
  if (!existing)
    return;
  await db.put("pending_operations", { ...existing, ...patch, updatedAt: Date.now() });
}

export async function putPhotoBlob(opId: string, blob: Blob) {
  const db = await openWanderlogDB();
  await db.put("photo_blobs", blob, opId);
}

export async function getPhotoBlob(opId: string): Promise<Blob | undefined> {
  const db = await openWanderlogDB();
  return db.get("photo_blobs", opId);
}

export async function deletePhotoBlob(opId: string) {
  const db = await openWanderlogDB();
  await db.delete("photo_blobs", opId);
}

export async function getPushSettings(): Promise<PushSettings | undefined> {
  const db = await openWanderlogDB();
  return db.get("push_settings", "settings");
}

export async function setPushSettings(settings: PushSettings) {
  const db = await openWanderlogDB();
  await db.put("push_settings", settings, "settings");
}

export async function estimateStorageUsage() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, ratio: 0 };
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, ratio: quota > 0 ? usage / quota : 0 };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  return navigator.storage.persist();
}

// Test utility: resets the cached connection so tests with `indexedDB.deleteDatabase("wanderlog")` see fresh schema.
export function resetWanderlogDBForTesting() {
  dbPromise = null;
}
