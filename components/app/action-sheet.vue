<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean;
  title?: string;
  dismissable?: boolean;
}>(), { dismissable: true });

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheetRef = ref<HTMLElement | null>(null);
const titleId = useId();

function close() {
  if (!props.dismissable)
    return;
  emit("update:open", false);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape")
    close();
}

watch(() => props.open, (open) => {
  if (open) {
    nextTick(() => sheetRef.value?.focus());
    document.addEventListener("keydown", onKey);
  }
  else {
    document.removeEventListener("keydown", onKey);
  }
});

onBeforeUnmount(() => document.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="motion-safe:transition-opacity motion-safe:duration-200"
      leave-active-class="motion-safe:transition-opacity motion-safe:duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] bg-black/40 md:hidden"
        @click="close"
      />
    </Transition>
    <Transition
      enter-active-class="motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-out"
      leave-active-class="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        ref="sheetRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        tabindex="-1"
        class="app-chrome-strong fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 outline-none md:hidden"
        @click.stop
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-chrome-border-strong)]" />
        <div
          v-if="title"
          :id="titleId"
          class="mb-3 text-base font-semibold tracking-tight"
        >
          {{ title }}
        </div>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
