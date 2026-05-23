<script lang="ts" setup>
const { canInstall, dismiss, install } = usePwaInstallPrompt();
</script>

<template>
  <section
    v-if="canInstall"
    class="app-chrome-strong w-full max-w-sm rounded-lg border p-3 text-sm backdrop-blur"
    aria-label="Установить WanderLog"
  >
    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-md bg-brand-emerald/10 text-brand-emerald">
        <Icon name="tabler:device-mobile" size="19" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">
          Установить WanderLog
        </p>
        <p class="app-chrome-muted mt-1 text-xs leading-5">
          Добавьте приложение на главный экран, чтобы быстрее возвращаться к маршрутам.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            class="btn btn-xs border-teal-700 bg-teal-700 text-white hover:border-teal-800 hover:bg-teal-800"
            type="button"
            @click="install()"
          >
            <Icon name="tabler:download" size="14" />
            Установить
          </button>
          <button
            class="btn btn-ghost btn-xs"
            type="button"
            @click="dismiss()"
          >
            Позже
          </button>
        </div>
      </div>
      <button
        aria-label="Закрыть предложение установки"
        class="btn btn-ghost btn-xs"
        type="button"
        @click="dismiss()"
      >
        <Icon name="tabler:x" size="14" />
      </button>
    </div>
  </section>
</template>
