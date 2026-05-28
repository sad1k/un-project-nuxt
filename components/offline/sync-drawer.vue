<script setup lang="ts">
import type { PendingOp } from "~/lib/offline/operation-types";

const open = defineModel<boolean>({ required: true });

const store = usePendingOperationsStore();
const queue = useOfflineQueue();

onMounted(() => {
  void store.refresh();
});

watch(open, (isOpen) => {
  if (isOpen)
    void store.refresh();
});

function opTitle(op: PendingOp): string {
  switch (op.type) {
    case "log.create":
      return `Создание записи: ${op.payload.name}`;
    case "log.update":
      return `Обновление записи #${op.payload.logId}`;
    case "photo.upload":
      return `Загрузка фото для записи #${op.payload.logId}`;
    case "post.like":
      return op.payload.action === "like"
        ? `Лайк поста #${op.payload.postId}`
        : `Отмена лайка поста #${op.payload.postId}`;
    case "post.comment":
      return `Комментарий к посту #${op.payload.postId}`;
  }
}

async function handleRetry(opId: string) {
  await queue.retry(opId);
  await store.refresh();
}

async function handleDrop(opId: string) {
  await queue.drop(opId);
  await store.refresh();
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="fixed inset-0 z-[100] flex justify-end">
        <div class="absolute inset-0 bg-black/30" @click="open = false" />
        <aside class="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-xl dark:bg-gray-900">
          <header class="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3 dark:bg-gray-900">
            <h2 class="text-base font-semibold">
              Очередь синхронизации ({{ store.totalCount }})
            </h2>
            <button
              class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Закрыть"
              @click="open = false"
            >
              <Icon name="lucide:x" class="size-5" />
            </button>
          </header>

          <ul v-if="store.operations.length" class="divide-y dark:divide-gray-800">
            <li
              v-for="op in store.operations"
              :key="op.opId"
              class="flex items-start gap-3 px-4 py-3"
            >
              <div v-if="op.type === 'photo.upload'" class="size-14 shrink-0">
                <OfflineQueuedPhotoThumb :op-id="op.opId" :status="op.status" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ opTitle(op) }}
                </p>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ formatTime(op.createdAt) }} · {{ op.retries }} попыт.
                </p>
                <p
                  v-if="op.lastError"
                  class="mt-1 truncate text-xs text-red-600 dark:text-red-400"
                  :title="op.lastError"
                >
                  {{ op.lastError }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <OfflinePendingBadge :status="op.status" />
                <button
                  v-if="op.status === 'expired' || op.status === 'conflict' || op.status === 'invalid'"
                  class="rounded p-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Повторить"
                  @click="handleRetry(op.opId)"
                >
                  <Icon name="lucide:rotate-cw" class="size-4" />
                </button>
                <button
                  class="rounded p-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Удалить из очереди"
                  @click="handleDrop(op.opId)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </button>
              </div>
            </li>
          </ul>
          <div v-else class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Очередь пуста
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 200ms ease;
}

.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 200ms ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
