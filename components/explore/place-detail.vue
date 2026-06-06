<script setup lang="ts">
import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { RouteMapPoint } from "~/lib/explore/route-map";

// Shared rich place content (photo carousel + tabs + reviews + actions) used by BOTH the desktop
// left sidebar (place-side-panel) and the mobile bottom sheet (place-bottom-sheet), so both get
// the same carousel/tabs/reviews. The wrappers handle their own chrome (close button / drag handle).
const props = defineProps<{
  place: RouteMapPoint | null;
  intelligence: PlaceIntelligence | null;
  // Granular per-section flags (photo vs details): the photo — prefetched while the route streamed
  // in — paints the instant the card opens, while reviews/rating/summary stream in behind it.
  loading: { details?: boolean; photo?: boolean };
  editable?: boolean;
}>();

const emit = defineEmits<{
  save: [point: RouteMapPoint];
  directions: [point: RouteMapPoint];
  story: [point: RouteMapPoint];
  edit: [point: RouteMapPoint];
  delete: [point: RouteMapPoint];
}>();

const { isOnline } = useOnline();

// Until the first progressive update lands there's no intelligence yet, so a generated stop counts
// as loading on both axes; after that the explicit photo/details flags drive each section apart.
const awaitingFirstPayload = computed(() => props.place?.markerKind === "generated" && !props.intelligence);
const photoLoading = computed(() => Boolean(props.loading.photo) || awaitingFirstPayload.value);
const detailsLoading = computed(() => Boolean(props.loading.details) || awaitingFirstPayload.value);
const summary = computed(() => props.intelligence?.aiSummary?.text || props.intelligence?.routeRationale || "");
const reviews = computed(() => props.intelligence?.reviews ?? []);
// The carousel reuses the gallery the provider already returned in one call (e.g. TripAdvisor's
// up-to-5 photos); falls back to the single hero photo when there's no gallery.
const gallery = computed(() => {
  const photo = props.intelligence?.photo;
  if (!photo)
    return [];
  return photo.gallery?.length ? photo.gallery : [photo.url];
});

type Tab = "overview" | "photos" | "reviews";
const activeTab = ref<Tab>("overview");
const carouselIndex = ref(0);

const confidenceLabel: Record<string, string> = { high: "высокая", medium: "средняя", low: "низкая" };

function nextPhoto() {
  if (gallery.value.length)
    carouselIndex.value = (carouselIndex.value + 1) % gallery.value.length;
}
function prevPhoto() {
  if (gallery.value.length)
    carouselIndex.value = (carouselIndex.value - 1 + gallery.value.length) % gallery.value.length;
}
function showPhoto(index: number) {
  carouselIndex.value = index;
  activeTab.value = "overview";
}

watch(() => props.place?.sourceId, () => {
  activeTab.value = "overview";
  carouselIndex.value = 0;
});
watch(gallery, (next) => {
  if (carouselIndex.value >= next.length)
    carouselIndex.value = 0;
});
</script>

<template>
  <div v-if="place" class="place-detail flex h-full min-h-0 flex-col">
    <!-- Photo carousel -->
    <div class="relative h-52 shrink-0" style="background: var(--explore-popup-photo-bg)">
      <div
        v-if="photoLoading"
        class="place-detail__skel h-full w-full"
        aria-hidden="true"
      />
      <template v-else-if="gallery.length">
        <img
          :key="gallery[carouselIndex]"
          :src="gallery[carouselIndex]"
          :alt="intelligence?.photo?.alt || place.name"
          class="h-full w-full object-cover"
          loading="lazy"
        >
        <figcaption
          v-if="intelligence?.photo"
          class="absolute inset-x-0 bottom-0 truncate px-3 py-1.5 text-[10px]"
          style="background: var(--explore-photo-caption-bg); color: var(--explore-primary-text)"
        >
          {{ intelligence.photo.attribution || intelligence.photo.source.label }}
        </figcaption>
        <template v-if="gallery.length > 1">
          <button
            type="button"
            class="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-md transition hover:scale-110"
            style="background: var(--explore-popup-backdrop); color: var(--explore-text)"
            aria-label="Предыдущее фото"
            @click="prevPhoto"
          >
            <Icon name="tabler:chevron-left" size="18" />
          </button>
          <button
            type="button"
            class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-md transition hover:scale-110"
            style="background: var(--explore-popup-backdrop); color: var(--explore-text)"
            aria-label="Следующее фото"
            @click="nextPhoto"
          >
            <Icon name="tabler:chevron-right" size="18" />
          </button>
          <div
            class="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md"
            style="background: var(--explore-popup-backdrop); color: var(--explore-text)"
          >
            <Icon name="tabler:photo" size="12" />{{ carouselIndex + 1 }} / {{ gallery.length }}
          </div>
          <div class="absolute inset-x-0 bottom-6 flex items-center justify-center gap-1">
            <button
              v-for="(_, index) in gallery"
              :key="index"
              type="button"
              class="h-1.5 rounded-full transition-all"
              :style="{ width: index === carouselIndex ? '16px' : '6px', background: index === carouselIndex ? 'var(--explore-primary-text)' : 'color-mix(in srgb, var(--explore-primary-text) 45%, transparent)' }"
              :aria-label="`Фото ${index + 1}`"
              @click="carouselIndex = index"
            />
          </div>
        </template>
      </template>
      <div
        v-else
        class="flex h-full w-full items-center justify-center px-6 text-center text-xs font-semibold"
        style="color: var(--explore-text-soft)"
      >
        Фото места недоступно
      </div>
    </div>

    <!-- Title -->
    <div class="shrink-0 px-5 pb-3 pt-4">
      <h2 class="text-xl font-bold leading-tight" style="color: var(--explore-text-strong)">
        {{ place.name }}
      </h2>
      <div class="mt-1.5 flex flex-wrap items-center gap-2">
        <span class="rounded-full px-2 py-0.5 text-[11px] font-bold" style="background: var(--explore-warning-bg); color: var(--explore-warning-text)">Точка маршрута</span>
        <span
          v-if="place.day"
          class="text-[11px] font-semibold"
          style="color: var(--explore-warning-text)"
        >День {{ place.day }}</span>
        <span
          v-if="intelligence?.rating"
          class="flex items-center gap-1 text-sm font-bold"
          style="color: var(--explore-text-strong)"
        >
          <Icon
            name="tabler:star-filled"
            size="15"
            style="color: var(--color-brand-gold, #f4b400)"
          />
          {{ intelligence.rating.value.toFixed(1) }}
          <span class="text-[11px] font-normal" style="color: var(--explore-text-soft)">({{ intelligence.rating.reviewCount ?? 0 }})</span>
        </span>
      </div>
    </div>

    <!-- Tabs -->
    <nav
      v-if="!detailsLoading"
      class="flex shrink-0 gap-4 border-b px-5"
      style="border-color: var(--explore-border)"
      aria-label="Разделы места"
    >
      <button
        v-for="tab in ([
          { key: 'overview', label: 'Обзор', count: 0 },
          { key: 'photos', label: 'Фото', count: gallery.length },
          { key: 'reviews', label: 'Отзывы', count: reviews.length },
        ] as { key: Tab; label: string; count: number }[])"
        :key="tab.key"
        type="button"
        class="relative -mb-px border-b-2 pb-2 pt-1 text-sm font-semibold transition"
        :style="{
          borderColor: activeTab === tab.key ? 'var(--explore-accent, #2563eb)' : 'transparent',
          color: activeTab === tab.key ? 'var(--explore-text-strong)' : 'var(--explore-text-soft)',
        }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}<span
          v-if="tab.count"
          class="ml-1 text-xs font-medium"
          style="color: var(--explore-text-soft)"
        >{{ tab.count }}</span>
      </button>
    </nav>

    <!-- Body -->
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
      <div
        v-if="detailsLoading"
        class="space-y-2"
        aria-hidden="true"
      >
        <div class="place-detail__skel h-3 w-full rounded" />
        <div class="place-detail__skel h-3 w-5/6 rounded" />
        <div class="place-detail__skel mt-3 h-14 w-full rounded-xl" />
      </div>

      <template v-else>
        <!-- Overview -->
        <div v-show="activeTab === 'overview'">
          <p
            v-if="summary"
            class="text-sm leading-relaxed"
            style="color: var(--explore-text-muted)"
          >
            {{ summary }}
          </p>
          <div
            v-if="intelligence?.cost"
            class="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
            style="background: var(--explore-surface-soft); color: var(--explore-text)"
          >
            <Icon name="tabler:cash" size="14" />{{ intelligence.cost.label }}
          </div>
          <p
            v-if="!summary && !intelligence?.cost"
            class="text-xs"
            style="color: var(--explore-text-soft)"
          >
            Подробностей пока нет.
          </p>
        </div>

        <!-- Photos -->
        <div v-show="activeTab === 'photos'" class="grid grid-cols-2 gap-2">
          <button
            v-for="(url, index) in gallery"
            :key="url"
            type="button"
            class="aspect-[4/3] overflow-hidden rounded-lg"
            style="background: var(--explore-popup-photo-bg)"
            @click="showPhoto(index)"
          >
            <img
              :src="url"
              :alt="`Фото ${index + 1}`"
              class="h-full w-full object-cover transition hover:scale-105"
              loading="lazy"
            >
          </button>
        </div>

        <!-- Reviews -->
        <div v-show="activeTab === 'reviews'">
          <ul v-if="reviews.length" class="flex flex-col gap-2.5">
            <li
              v-for="(review, index) in reviews"
              :key="index"
              class="rounded-xl border p-3"
              style="border-color: var(--explore-border); background: var(--explore-surface-soft)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-xs font-semibold" style="color: var(--explore-text)">{{ review.authorLabel || "Отзыв из источника" }}</span>
                <span
                  v-if="review.rating"
                  class="flex shrink-0 items-center gap-0.5 text-xs font-bold"
                  style="color: var(--color-brand-gold, #f4b400)"
                >
                  <Icon name="tabler:star-filled" size="12" />{{ review.rating }}
                </span>
              </div>
              <p class="mt-1.5 text-[13px] leading-relaxed" style="color: var(--explore-text-muted)">
                {{ review.text }}
              </p>
              <div class="mt-1.5 text-[10px]" style="color: var(--explore-text-faint)">
                {{ review.source.label }}<template v-if="review.relativeTime">
                  · {{ review.relativeTime }}
                </template> · уверенность: {{ confidenceLabel[review.source.confidence] ?? review.source.confidence }}
              </div>
            </li>
          </ul>
          <p
            v-else
            class="rounded-xl border border-dashed px-3 py-4 text-center text-xs"
            style="border-color: var(--explore-border); color: var(--explore-text-soft)"
          >
            Отзывов из источников пока нет
          </p>
        </div>
      </template>
    </div>

    <!-- Sticky actions -->
    <div class="shrink-0 border-t px-4 py-3" style="border-color: var(--explore-border); background: var(--explore-popup-backdrop)">
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition hover:opacity-90"
          style="background: var(--explore-text-strong); color: var(--explore-surface-strong)"
          @click="emit('save', place)"
        >
          <Icon name="tabler:bookmark" size="15" />Сохранить
        </button>
        <button
          type="button"
          class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition hover:opacity-90"
          style="border-color: var(--explore-border); color: var(--explore-text-muted)"
          @click="emit('directions', place)"
        >
          <Icon name="tabler:route" size="15" />Маршрут
        </button>
      </div>
      <button
        v-if="isOnline && place.markerKind === 'generated'"
        type="button"
        class="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition hover:opacity-90"
        style="border-color: var(--explore-warning-border); background: var(--explore-warning-bg); color: var(--explore-warning-text)"
        @click="emit('story', place)"
      >
        <Icon name="tabler:headphones" size="15" />Слушать историю
      </button>
      <div v-if="editable && place.markerKind === 'generated'" class="mt-2 flex gap-2">
        <button
          type="button"
          class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition"
          style="border-color: var(--explore-border); color: var(--explore-text-muted)"
          @click="emit('edit', place)"
        >
          <Icon name="tabler:edit" size="14" />Изменить
        </button>
        <button
          type="button"
          class="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition"
          style="border-color: var(--explore-border); color: var(--explore-danger-text, #ef4444)"
          @click="emit('delete', place)"
        >
          <Icon name="tabler:trash" size="14" />Удалить
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.place-detail__skel {
  position: relative;
  overflow: hidden;
  background: var(--explore-surface-soft);
}
.place-detail__skel::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--explore-text) 9%, transparent), transparent);
  animation: placeDetailShimmer 1.25s ease-in-out infinite;
}
@keyframes placeDetailShimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .place-detail__skel::after {
    animation: none;
  }
}
</style>
