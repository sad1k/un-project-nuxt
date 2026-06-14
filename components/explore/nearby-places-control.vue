<script lang="ts" setup>
import type { ExploreNearbyPlace } from "~/lib/explore/nearby";

import { formatRouteDistance } from "~/lib/explore/route-map";

const nearby = useNearbyPlaces();

const isActive = nearby.isActive;
const status = nearby.status;
const places = nearby.places;
const selectedId = nearby.selectedId;
const errorMessage = nearby.error;

const count = computed(() => places.value.length);
const isBusy = computed(() => status.value === "locating" || status.value === "loading");

function onRowClick(place: ExploreNearbyPlace) {
  nearby.select(selectedId.value === place.id ? null : place.id);
}

function onAdd(place: ExploreNearbyPlace) {
  nearby.addPlace(place);
}

function distanceLabel(meters?: number) {
  return formatRouteDistance(meters ?? null);
}
</script>

<template>
  <Transition name="nearby-panel">
    <div
      v-if="isActive"
      class="explore-popover pointer-events-auto fixed inset-x-3 bottom-[84px] z-[55] flex max-h-[50vh] flex-col overflow-hidden rounded-2xl border p-3 md:inset-x-auto md:bottom-auto md:left-[80px] md:top-20 md:max-h-[calc(100vh-7rem)] md:w-72"
      data-testid="explore-nearby-panel"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 text-sm font-semibold">
          <Icon
            class="text-brand-gold"
            name="tabler:map-pin-search"
            size="16"
          />
          Места рядом
        </span>
        <span
          v-if="count"
          class="explore-text-soft text-xs font-medium"
        >{{ count }}</span>
      </div>

      <!-- Status / hint line. -->
      <div
        v-if="status === 'locating' || status === 'loading'"
        class="explore-text-soft mt-2 flex items-center gap-2 text-xs leading-snug"
      >
        <Icon
          class="animate-spin text-brand-gold"
          name="tabler:loader-2"
          size="14"
        />
        {{ status === "locating" ? "Определяем ваше местоположение…" : "Ищем интересные места рядом…" }}
      </div>
      <div
        v-else-if="status === 'denied'"
        class="mt-2 rounded-lg border px-2.5 py-2 text-xs leading-snug"
        style="border-color: var(--explore-warning-border); background: var(--explore-warning-bg); color: var(--explore-warning-text)"
      >
        Доступ к геолокации запрещён. Разрешите доступ к местоположению и попробуйте снова.
      </div>
      <div
        v-else-if="status === 'error'"
        class="mt-2 rounded-lg border px-2.5 py-2 text-xs leading-snug"
        style="border-color: var(--explore-danger-border); background: var(--explore-danger-bg); color: var(--explore-danger-text)"
      >
        {{ errorMessage || "Не удалось загрузить места рядом." }}
      </div>
      <div
        v-else-if="status === 'empty'"
        class="explore-text-soft mt-2 text-xs leading-snug"
      >
        Рядом ничего не нашлось. Перетащите метку на карте или измените интересы.
      </div>
      <p
        v-else-if="status === 'ready'"
        class="explore-text-soft mt-2 text-xs leading-snug"
      >
        Перетащите метку на карте, чтобы искать вокруг другой точки. Нажмите «Добавить», чтобы сделать место своей опорной точкой.
      </p>
      <p
        v-else
        class="explore-text-soft mt-2 text-xs leading-snug"
      >
        Найдём интересные места по вашим интересам рядом с вашим местоположением.
      </p>

      <ul
        v-if="count"
        class="scroll-thin mt-2 flex-1 space-y-1 overflow-y-auto pr-1"
      >
        <li
          v-for="(place, index) in places"
          :key="place.id"
        >
          <div
            class="flex items-center gap-2 rounded-lg border px-2 py-1.5 transition"
            :style="selectedId === place.id
              ? 'border-color: var(--explore-warning-border); background: var(--explore-warning-bg)'
              : 'border-color: var(--explore-border); background: var(--explore-surface)'"
          >
            <button
              class="flex min-w-0 flex-1 items-center gap-2 text-left"
              type="button"
              @click="onRowClick(place)"
            >
              <span
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style="background: var(--explore-marker-current)"
              >{{ index + 1 }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-semibold">{{ place.name }}</span>
                <span class="explore-text-soft block truncate text-[10px]">
                  {{ [place.categoryLabel, distanceLabel(place.distanceMeters)].filter(Boolean).join(" · ") }}
                </span>
              </span>
            </button>
            <button
              v-if="nearby.isAdded(place.id)"
              class="shrink-0 rounded-md p-1 text-brand-gold"
              disabled
              type="button"
              :aria-label="`${place.name} добавлено`"
            >
              <Icon name="tabler:circle-check-filled" size="16" />
            </button>
            <button
              v-else
              class="explore-text-soft shrink-0 rounded-md p-1 transition hover:text-brand-gold"
              type="button"
              :aria-label="`Добавить ${place.name}`"
              @click="onAdd(place)"
            >
              <Icon name="tabler:map-pin-plus" size="16" />
            </button>
          </div>
        </li>
      </ul>

      <div class="mt-3 flex items-center gap-2">
        <button
          class="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          style="border-color: var(--explore-border); color: var(--explore-text-muted)"
          :disabled="isBusy"
          data-testid="explore-nearby-relocate"
          type="button"
          @click="nearby.locate()"
        >
          <Icon
            :class="isBusy ? 'animate-spin' : ''"
            :name="isBusy ? 'tabler:loader-2' : 'tabler:current-location'"
            size="14"
          />
          Моё местоположение
        </button>
        <button
          class="flex h-8 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition"
          style="border-color: var(--explore-border); color: var(--explore-text-muted)"
          type="button"
          @click="nearby.deactivate()"
        >
          <Icon name="tabler:check" size="14" />
          Готово
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nearby-panel-enter-active,
.nearby-panel-leave-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}
.nearby-panel-enter-from,
.nearby-panel-leave-to {
  transform: translateY(8px) scale(0.98);
  opacity: 0;
}
</style>
