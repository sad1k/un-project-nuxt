<script setup lang="ts">
import type { FetchError } from "ofetch";
import type { z } from "zod";

import { toTypedSchema } from "@vee-validate/zod";

import type { SearchLocation } from "~/lib/types";

import { SearchLocationQuery } from "~/lib/db/schema/search-location";

const emit = defineEmits<{
  resultSelected: [result: SearchLocation];
}>();

const searchLocations = ref<SearchLocation[] | null>(null);
const form = useTemplateRef("form");
const loading = ref(false);
const error = ref<string | null>(null);

async function handleSubmit(values: Record<string, unknown>) {
  try {
    loading.value = true;
    const typedValues = values as z.infer<typeof SearchLocationQuery>;
    searchLocations.value = null;
    error.value = null;
    const data = await $fetch("/api/search-locations", {
      query: {
        q: typedValues.q,
      },
    });
    searchLocations.value = data;
    loading.value = false;
  }
  catch (e) {
    const errorMessage = e as FetchError;
    error.value = errorMessage.data?.statusMessage || errorMessage.statusMessage || "Неизвестная ошибка";
    loading.value = false;
  }
}

function onSelect(searchLocation: SearchLocation) {
  emit("resultSelected", searchLocation);
  form.value?.resetForm();
  searchLocations.value = null;
}
</script>

<template>
  <div>
    <div class="text-xs text-gray-400 mb-4 italic text-left align-left">
      Поиск работает на <a
        href="https://nominatim.org/"
        target="_blank"
        class="text-primary"
      >Nominatim</a>
    </div>
    <Form
      ref="form"
      v-slot="{ errors }"
      class="join w-full my-2 justify-center"
      :validation-schema="toTypedSchema(SearchLocationQuery)"
      :initial-values="{
        q: '',
      }"
      @submit="handleSubmit"
    >
      <div>
        <label class="input validator join-item">
          <svg
            class="h-[1em] opacity-50"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <g
              stroke-linejoin="round"
              stroke-linecap="round"
              stroke-width="2.5"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />
              <path d="m21 21-4.3-4.3" />
            </g>
          </svg>
          <Field
            as="input"
            name="q"
            type="text"
            placeholder="Поиск места"
            required
            :class="{ 'input-error': errors.q }"
          />
        </label>
        <div v-if="errors.q" class="validator-hint text-error text-xs mt-1">
          {{ errors.q }}
        </div>
      </div>
      <button
        type="submit"
        class="btn btn-neutral join-item"
        :disabled="loading"
      >
        Поиск
      </button>
    </Form>

    <div
      v-if="error && !loading"
      role="alert"
      class="alert alert-error"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{{ error }}</span>
    </div>
    <div v-if="loading" class="flex justify-center items-center">
      <span class="loading loading-spinner text-primary" />
    </div>
    <div v-else-if="searchLocations && searchLocations.length > 0" class="flex flex-col overflow-auto gap-2 max-h-35">
      <div
        v-for="searchLocation in searchLocations"
        :key="searchLocation.place_id"
        class="flex flex-col gap-10"
      >
        <div class="card w-96 bg-base-100 card-sm shadow-sm">
          <div class="card-body">
            <h2 class="card-title">
              {{ searchLocation.display_name }}
            </h2>
            <div class="justify-end card-actions">
              <button class="btn btn-warning" @click="onSelect(searchLocation)">
                Выбрать
                <Icon name="tabler:check" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="searchLocations && searchLocations.length === 0 && !loading && !error"
      class="flex justify-center items-center"
    >
      <span class="text-gray-500">Ничего не найдено</span>
    </div>
  </div>
</template>
