<script setup lang="ts">
import type { PendingStatus } from "~/lib/offline/operation-types";

const props = defineProps<{ status: PendingStatus }>();

const config = computed(() => {
  switch (props.status) {
    case "pending":
      return { icon: "lucide:clock", color: "text-amber-500", label: "В очереди" };
    case "auth_required":
      return { icon: "lucide:lock", color: "text-amber-600", label: "Требуется вход" };
    case "conflict":
      return { icon: "lucide:alert-triangle", color: "text-orange-500", label: "Конфликт" };
    case "invalid":
      return { icon: "lucide:x-circle", color: "text-red-500", label: "Ошибка валидации" };
    case "expired":
      return { icon: "lucide:alert-circle", color: "text-red-600", label: "Истёкло" };
    case "corrupted":
      return { icon: "lucide:file-x", color: "text-red-700", label: "Данные потеряны" };
    default:
      return { icon: "lucide:circle", color: "text-gray-400", label: "Неизвестно" };
  }
});
</script>

<template>
  <span
    :class="['inline-flex items-center gap-1 text-xs', config.color]"
    :title="config.label"
    :aria-label="config.label"
  >
    <Icon :name="config.icon" class="size-3.5" />
  </span>
</template>
