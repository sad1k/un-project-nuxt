import { nanoid } from "nanoid";

import type { PendingOp, PendingOpKind, PhotoUploadOp } from "~/lib/offline/operation-types";

import {
  deletePhotoBlob,
  estimateStorageUsage,
  getPhotoBlob,
  getPushSettings,
  listOperations,
  putOperation,
  putPhotoBlob,
  removeOperation,
  requestPersistentStorage,
  updateOperationStatus,
} from "~/lib/offline/idb";

type EnqueueResult = {
  opId: string;
  /**
   * For online requests, the actual HTTP response.
   * For offline-deferred requests, a synthetic 202 response shape.
   */
  response: Response;
};

type RequestSpec = {
  url: string;
  method: "POST" | "PUT" | "DELETE";
  body: unknown;
};

function mapToRequest(kind: Exclude<PendingOpKind, PhotoUploadOp>): RequestSpec {
  switch (kind.type) {
    case "log.create":
      return {
        url: `/api/locations/${kind.payload.locationSlug}/add`,
        method: "POST",
        body: kind.payload,
      };
    case "log.update":
      return {
        url: `/api/locations/${kind.payload.locationSlug}/${kind.payload.logId}`,
        method: "PUT",
        body: kind.payload,
      };
    case "post.like":
      return {
        url: `/api/posts/${kind.payload.postId}/like`,
        method: kind.payload.action === "like" ? "POST" : "DELETE",
        body: {},
      };
    case "post.comment":
      return {
        url: `/api/posts/${kind.payload.postId}/comments`,
        method: "POST",
        body: kind.payload,
      };
  }
}

async function computeChecksum(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export function useOfflineQueue() {
  const csrfFn = typeof useCsrf === "function" ? useCsrf : null;

  async function enqueue(kind: Exclude<PendingOpKind, PhotoUploadOp>, opIdOverride?: string): Promise<EnqueueResult> {
    const opId = opIdOverride || nanoid();
    const now = Date.now();
    const op: PendingOp = {
      ...kind,
      opId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      retries: 0,
    };
    await putOperation(op);

    const spec = mapToRequest(kind);
    try {
      const csrf = csrfFn?.()?.csrf?.value;
      const response = await fetch(spec.url, {
        method: spec.method,
        body: JSON.stringify(spec.body),
        headers: {
          "content-type": "application/json",
          "x-client-op-id": opId,
          ...(csrf ? { "csrf-token": csrf } : {}),
        },
      });

      if (response.ok) {
        await removeOperation(opId);
      }
      else if (response.status === 401) {
        await updateOperationStatus(opId, { status: "auth_required", lastError: "Session expired" });
      }
      else if (response.status === 409) {
        await updateOperationStatus(opId, { status: "conflict" });
      }
      else if (response.status === 422) {
        const text = await response.clone().text();
        await updateOperationStatus(opId, { status: "invalid", lastError: text });
      }
      return { opId, response };
    }
    catch {
      // Network failure — SW BackgroundSync queue holds the request, our IDB op stays pending
      return { opId, response: new Response(JSON.stringify({ queued: true }), { status: 202 }) };
    }
  }

  async function enqueuePhoto(blob: Blob, meta: { locationSlug: string; logId: number }): Promise<{ opId: string }> {
    // Ask for persistent storage on first enqueue so OS doesn't evict the IDB blob under pressure
    await requestPersistentStorage();

    // Quota guard: refuse new enqueue above 80% to leave headroom for the resize buffer
    const { ratio } = await estimateStorageUsage();
    if (ratio > 0.8)
      throw new Error("Хранилище заполнено — удалите старые pending загрузки");

    const opId = nanoid();
    await putPhotoBlob(opId, blob);
    const checksum = await computeChecksum(blob);
    const now = Date.now();
    const op: PendingOp = {
      type: "photo.upload",
      payload: {
        locationSlug: meta.locationSlug,
        logId: meta.logId,
        blobRef: opId,
        mimeType: blob.type,
        checksum,
      },
      opId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      retries: 0,
    };
    await putOperation(op);
    void processPhotoOp(op);
    return { opId };
  }

  async function processPhotoOp(op: PendingOp): Promise<void> {
    if (op.type !== "photo.upload")
      return;

    try {
      const blob = await getPhotoBlob(op.opId);
      if (!blob) {
        await updateOperationStatus(op.opId, { status: "corrupted", lastError: "Blob missing in IDB" });
        return;
      }

      const csrf = csrfFn?.()?.csrf?.value;
      const headers: Record<string, string> = {
        "x-client-op-id": op.opId,
        ...(csrf ? { "csrf-token": csrf } : {}),
      };

      let key: string | undefined = op.payload.key;

      if (op.payload.partial !== "s3-done") {
        const signResponse = await $fetch<{ url: string; fields: Record<string, string>; key: string }>(
          `/api/locations/${op.payload.locationSlug}/${op.payload.logId}/sign-images`,
          {
            method: "POST",
            headers,
            body: { checksum: op.payload.checksum, contentLength: blob.size },
          },
        );

        const formData = new FormData();
        for (const [k, v] of Object.entries(signResponse.fields))
          formData.append(k, v);
        formData.append("file", blob);

        const s3Response = await fetch(signResponse.url, { method: "POST", body: formData });
        if (!s3Response.ok)
          throw new Error(`S3 upload failed with status ${s3Response.status}`);

        key = signResponse.key;
        await updateOperationStatus(op.opId, {
          payload: { ...op.payload, partial: "s3-done", key },
        } as Partial<PendingOp>);
      }

      await $fetch(`/api/locations/${op.payload.locationSlug}/${op.payload.logId}/image`, {
        method: "POST",
        headers,
        body: { key },
      });

      await deletePhotoBlob(op.opId);
      await removeOperation(op.opId);
      broadcastSuccess(op.opId);
      void showUploadSuccessNotification();
    }
    catch (err) {
      const nextRetries = (op.retries || 0) + 1;
      if (nextRetries >= 5)
        await updateOperationStatus(op.opId, { status: "expired", retries: nextRetries, lastError: String(err) });
      else
        await updateOperationStatus(op.opId, { retries: nextRetries, lastError: String(err) });
    }
  }

  async function drop(opId: string) {
    await deletePhotoBlob(opId);
    await removeOperation(opId);
  }

  async function retry(opId: string) {
    const all = await listOperations();
    const op = all.find(o => o.opId === opId);
    if (!op)
      return;
    await updateOperationStatus(opId, { status: "pending", retries: 0, lastError: undefined });
    if (op.type === "photo.upload")
      void processPhotoOp({ ...op, status: "pending", retries: 0, lastError: undefined });
  }

  async function peek() {
    return listOperations();
  }

  async function resumeSyncAfterLogin() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: "wl-manual-sync" });
      // Also re-process any photo ops that were stuck in `auth_required`
      const all = await listOperations();
      for (const op of all) {
        if (op.type === "photo.upload" && op.status === "auth_required") {
          await updateOperationStatus(op.opId, { status: "pending", retries: 0, lastError: undefined });
          void processPhotoOp({ ...op, status: "pending", retries: 0, lastError: undefined });
        }
      }
    }
    catch {
      // best effort
    }
  }

  return { enqueue, enqueuePhoto, drop, retry, peek, resumeSyncAfterLogin };
}

function broadcastSuccess(opId: string) {
  if (typeof BroadcastChannel === "undefined")
    return;
  const channel = new BroadcastChannel("wl-sync");
  try {
    channel.postMessage({ status: "success", opId });
  }
  finally {
    channel.close();
  }
}

async function showUploadSuccessNotification() {
  if (typeof window === "undefined" || typeof Notification === "undefined")
    return;
  if (Notification.permission !== "granted")
    return;
  const settings = await getPushSettings();
  if (settings && !settings.upload)
    return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Фото загружено", {
        body: "Очередная загрузка успешно отправилась на сервер",
        tag: "upload-success",
        icon: "/icons/wanderlog-icon-192.png",
      });
    }
  }
  catch {
    // Best-effort; ignore notification failures
  }
}
