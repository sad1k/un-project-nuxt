import { defineStore } from "pinia";

import type { PendingOp, PendingStatus } from "~/lib/offline/operation-types";

import { listOperations, removeOperation, updateOperationStatus } from "~/lib/offline/idb";

export const usePendingOperationsStore = defineStore("pending-operations", () => {
  const operations = ref<PendingOp[]>([]);
  let channel: BroadcastChannel | null = null;

  async function refresh() {
    if (!import.meta.client)
      return;
    operations.value = await listOperations();
  }

  async function handleSyncMessage(event: MessageEvent) {
    const data = event.data || {};
    const opId: string | undefined = data.opId;
    const status: PendingStatus | "success" | undefined = data.status;
    if (!opId || !status)
      return;

    if (status === "success") {
      await removeOperation(opId);
      operations.value = operations.value.filter(o => o.opId !== opId);
      return;
    }

    const idx = operations.value.findIndex(o => o.opId === opId);
    await updateOperationStatus(opId, { status });
    if (idx >= 0)
      operations.value[idx] = { ...operations.value[idx], status };
  }

  async function init() {
    if (!import.meta.client)
      return;
    await refresh();
    if (!channel && typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("wl-sync");
      channel.addEventListener("message", handleSyncMessage);
    }
  }

  function dispose() {
    if (channel) {
      channel.removeEventListener("message", handleSyncMessage);
      channel.close();
      channel = null;
    }
  }

  const pendingCount = computed(() => operations.value.filter(o => o.status === "pending").length);
  const blockedCount = computed(() => operations.value.filter(o => o.status !== "pending").length);
  const totalCount = computed(() => operations.value.length);

  return {
    operations: readonly(operations),
    pendingCount,
    blockedCount,
    totalCount,
    init,
    refresh,
    dispose,
  };
});
