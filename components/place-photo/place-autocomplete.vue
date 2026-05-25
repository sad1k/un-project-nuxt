<script lang="ts" setup>
import type { FetchError } from "ofetch";

import type { SearchLocation } from "~/lib/types";

const props = withDefaults(defineProps<{
  placeholder?: string;
  debounceMs?: number;
}>(), {
  placeholder: "Поиск места — кафе, парк, улица…",
  debounceMs: 350,
});

const emit = defineEmits<{
  (event: "selected", result: SearchLocation): void;
}>();

const query = ref("");
const results = ref<SearchLocation[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const open = ref(false);
const root = ref<HTMLElement | null>(null);

let timer: ReturnType<typeof setTimeout> | null = null;
let activeRequestId = 0;

function shortenLabel(name: string) {
  return name.length > 90 ? `${name.slice(0, 87)}…` : name;
}

function reset() {
  results.value = [];
  error.value = null;
  loading.value = false;
}

async function performSearch(value: string) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  if (value.trim().length < 2) {
    reset();
    return;
  }

  loading.value = true;
  open.value = true;
  error.value = null;
  const requestId = ++activeRequestId;

  try {
    const data = await $fetch<SearchLocation[]>("/api/search-locations", {
      query: { q: value.trim() },
    });
    if (requestId !== activeRequestId)
      return;

    results.value = data;
  }
  catch (err) {
    if (requestId !== activeRequestId)
      return;
    const fetchError = err as FetchError;
    error.value = fetchError.data?.statusMessage || fetchError.statusMessage || "Не удалось получить подсказки";
    results.value = [];
  }
  finally {
    if (requestId === activeRequestId) {
      loading.value = false;
    }
  }
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  query.value = value;
  open.value = true;

  if (timer)
    clearTimeout(timer);

  timer = setTimeout(() => performSearch(value), props.debounceMs);
}

function onFocus() {
  if (query.value.trim().length >= 2)
    open.value = true;
}

function onSelect(result: SearchLocation) {
  emit("selected", result);
  query.value = "";
  results.value = [];
  open.value = false;
}

function onDocumentClick(event: MouseEvent) {
  if (!root.value)
    return;
  if (!root.value.contains(event.target as Node)) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
  if (timer)
    clearTimeout(timer);
  document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <div ref="root" class="place-photo-autocomplete relative w-full">
    <label class="group flex h-11 w-full items-center gap-2 rounded-full border border-white/10 bg-black/55 px-4 text-sm text-white shadow-lg shadow-black/30 backdrop-blur-md transition focus-within:border-brand-gold/55 focus-within:bg-black/65 focus-within:ring-2 focus-within:ring-brand-gold/25">
      <Icon name="tabler:search" size="18" class="shrink-0 text-white/65" />
      <input
        :value="query"
        type="search"
        class="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        :aria-expanded="open"
        aria-autocomplete="list"
        aria-controls="place-photo-autocomplete-list"
        @input="onInput"
        @focus="onFocus"
      >
      <span
        v-if="loading"
        class="loading loading-spinner loading-xs shrink-0 text-brand-gold"
        aria-label="Поиск…"
      />
      <button
        v-else-if="query"
        type="button"
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
        aria-label="Очистить"
        title="Очистить поле"
        @click.stop="() => { query = ''; reset(); open = false; }"
      >
        <Icon name="tabler:x" size="14" />
      </button>
    </label>

    <div
      v-if="open && (results.length || error || (!loading && query.trim().length >= 2))"
      id="place-photo-autocomplete-list"
      class="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/85 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
      role="listbox"
    >
      <div v-if="error" class="px-3 py-2 text-sm text-rose-300">
        {{ error }}
      </div>
      <ul v-else-if="results.length" class="flex flex-col">
        <li v-for="result in results" :key="result.place_id">
          <button
            type="button"
            class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left text-white transition hover:bg-white/10"
            role="option"
            :aria-label="`Выбрать ${result.display_name}`"
            :title="result.display_name"
            @click="onSelect(result)"
          >
            <Icon name="tabler:map-pin" size="16" class="mt-0.5 shrink-0 text-brand-gold" />
            <span class="min-w-0 text-sm leading-snug">
              {{ shortenLabel(result.display_name) }}
            </span>
          </button>
        </li>
      </ul>
      <div v-else-if="!loading && query.trim().length >= 2" class="px-3 py-2 text-sm text-white/55">
        Ничего не нашли. Попробуйте уточнить запрос.
      </div>
    </div>
    <p class="mt-1.5 pl-4 text-[11px] text-white/40">
      Поиск работает на
      <a
        href="https://nominatim.org/"
        target="_blank"
        rel="noopener"
        class="text-brand-gold/80 underline-offset-2 hover:underline"
      >Nominatim</a>
    </p>
  </div>
</template>
