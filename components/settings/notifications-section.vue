<script setup lang="ts">
import type { PushType } from "~/composables/use-push-notifications";

const push = usePushNotifications();
const saving = ref(false);

onMounted(() => {
  void push.loadStoredSettings();
});

const types: Array<{ key: PushType; label: string; help: string }> = [
  { key: "social", label: "Социальные", help: "Лайки, комментарии и ответы на ваши посты" },
  { key: "upload", label: "Загрузки", help: "Уведомления когда офлайн-загрузка фото успешно завершилась" },
  { key: "reminders", label: "Напоминания", help: "Напоминания о записях в дневнике и предложенных маршрутах" },
  { key: "route", label: "Маршруты", help: "Готовность сгенерированных AI-маршрутов" },
];

async function toggle(key: PushType, value: boolean) {
  saving.value = true;
  try {
    if (value) {
      const next = { ...push.settings.value, [key]: true };
      await push.updateSettings(next);
      if (!push.enabled.value)
        await push.requestPermissionAndSubscribe();
    }
    else {
      await push.unsubscribeType(key);
    }
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
    <header class="mb-3">
      <h2 class="text-base font-semibold">
        Push-уведомления
      </h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Выберите, какие события показывать в виде системных уведомлений
      </p>
    </header>

    <p v-if="push.error.value" class="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
      {{ push.error.value }}
    </p>

    <ul class="divide-y divide-gray-100 dark:divide-white/5">
      <li v-for="t in types" :key="t.key" class="flex items-start justify-between gap-4 py-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">
            {{ t.label }}
          </p>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {{ t.help }}
          </p>
        </div>
        <label class="flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            class="peer sr-only"
            :checked="push.settings.value[t.key]"
            :disabled="saving"
            @change="toggle(t.key, ($event.target as HTMLInputElement).checked)"
          >
          <span class="relative inline-block h-6 w-10 rounded-full bg-gray-300 transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50 dark:bg-gray-600">
            <span class="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
      </li>
    </ul>
  </section>
</template>
