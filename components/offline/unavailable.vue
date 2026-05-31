<script lang="ts" setup>
// `<OfflineUnavailable>` — reusable placeholder for features that cannot
// work without a network connection.
//
// Two ways to use:
//   1. As a wrapper around the original UI (slot is rendered when online,
//      replaced with the placeholder when offline):
//        <OfflineUnavailable label="Загрузка фото" variant="overlay">
//          <PhotoUploader />
//        </OfflineUnavailable>
//
//   2. As a standalone placeholder gated by `v-if`/`v-else-if` in a parent
//      component (no slot, the parent already decides when to render us):
//        <OfflineUnavailable
//          v-if="isOffline && !story?.audio"
//          label="AI-история"
//          variant="inline"
//        />

withDefaults(defineProps<{
  /** Stable identifier — surfaces as `data-offline-feature` for trackers/QA. */
  feature?: string;
  /** Short human-readable name of the unavailable feature. */
  label: string;
  /** Helper text shown next to / under the label. */
  reason?: string;
  /** Tabler icon name (defaults to a wifi-off glyph). */
  icon?: string;
  /**
   * - `inline`  — chip-sized warning, drops into a row of buttons.
   * - `card`    — empty-state block for whole sections (feed, list).
   * - `overlay` — translucent scrim on top of the slot, preserves the
   *               original UI as visual context.
   */
  variant?: "inline" | "card" | "overlay";
}>(), {
  feature: undefined,
  reason: "Будет доступно, когда появится сеть",
  icon: "tabler:wifi-off",
  variant: "inline",
});

const slots = useSlots();
const { isOnline } = useOnline();
const hasSlot = computed(() => Boolean(slots.default));
</script>

<template>
  <!-- Online + slot provided: pass through unchanged. -->
  <slot v-if="isOnline && hasSlot" />

  <!-- INLINE: chip-style, fits inside a button row or list. -->
  <span
    v-else-if="!isOnline && variant === 'inline'"
    class="inline-flex cursor-not-allowed select-none items-center gap-1.5 rounded-md border border-[var(--explore-warning-border)] bg-[var(--explore-warning-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--explore-warning-text)]"
    role="status"
    :aria-label="`${label} — ${reason}`"
    :title="reason"
    :data-offline-feature="feature"
  >
    <Icon :name="icon" size="14" />
    <span>{{ label }} · доступно онлайн</span>
  </span>

  <!-- CARD: empty-state block for a whole section. -->
  <div
    v-else-if="!isOnline && variant === 'card'"
    class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--explore-border-strong)] bg-[var(--explore-surface-soft)] p-6 text-center text-[var(--explore-text-muted)]"
    role="status"
    :data-offline-feature="feature"
  >
    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--explore-warning-bg)] text-[var(--explore-warning-text)]">
      <Icon :name="icon" size="20" />
    </div>
    <h4 class="text-sm font-bold text-[var(--explore-text)]">
      {{ label }} недоступно офлайн
    </h4>
    <p class="text-xs leading-5">
      {{ reason }}
    </p>
  </div>

  <!-- OVERLAY: scrim on top of the slot. Keeps the original UI as context. -->
  <div
    v-else-if="!isOnline && variant === 'overlay'"
    class="relative"
    :data-offline-feature="feature"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none opacity-40"
    >
      <slot />
    </div>
    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[var(--explore-loading-scrim)] backdrop-blur-sm"
      role="status"
    >
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--explore-warning-bg)] text-[var(--explore-warning-text)]">
        <Icon :name="icon" size="20" />
      </div>
      <p class="text-sm font-bold text-[var(--explore-text)]">
        {{ label }} недоступно офлайн
      </p>
      <p class="text-xs text-[var(--explore-text-muted)]">
        {{ reason }}
      </p>
    </div>
  </div>
</template>
