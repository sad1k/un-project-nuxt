<script lang="ts" setup generic="T extends LatLongItem">
import type { FetchError } from "ofetch";
import type { ZodSchema } from "zod";

import type { LatLongItem, SearchLocation } from "~/lib/types";

const props = defineProps<{
  initialValues: T;
  onSubmit: (values: T) => Promise<any>;
  schema: ZodSchema;
  submitButtonText?: string;
  submitButtonIcon?: string;
  onSubmitComplete?: () => void;
}>();

const mapStore = useMapStore();

const router = useRouter();
const loading = ref(false);
const submitted = ref(false);
const submitErrors = ref<Record<string, string>>({});

const {
  handleSubmit,
  errors,
  meta,
  setErrors,
  setFieldValue,
  controlledValues,
} = useForm({
  validationSchema: toTypedSchema(props.schema),
  initialValues: props.initialValues,
});

function formatNumber(value?: number) {
  if (!value)
    return 0;
  return value.toFixed(5);
}

function onResultSelected(location: SearchLocation) {
  if (mapStore.addedPoint) {
    const lat = Number.parseFloat(location.lat);
    const lon = Number.parseFloat(location.lon);
    setFieldValue("long", lon);
    setFieldValue("name", location.display_name);
    setFieldValue("lat", lat);
    mapStore.addedPoint.lat = lat;
    mapStore.addedPoint.long = lon;
    mapStore.flyToPoint = {
      ...mapStore.addedPoint,
      lat,
      long: lon,
    };
  }
}

const onSubmit = handleSubmit(async (values) => {
  try {
    loading.value = true;
    await props.onSubmit(values);
    submitted.value = true;
    loading.value = false;
    props.onSubmitComplete?.();
  }
  catch (error) {
    const errorMessage = error as FetchError;
    setErrors(errorMessage.data?.data || {});
    submitErrors.value = { submit: errorMessage.data?.statusMessage || errorMessage.statusMessage || "Неизвестная ошибка" };
    loading.value = false;
  }
});

effect(() => {
  if (mapStore.addedPoint) {
    setFieldValue("long", mapStore.addedPoint.long);
    setFieldValue("lat", mapStore.addedPoint.lat);
  }
});

onMounted(() => {
  mapStore.addedPoint = {
    ...props.initialValues,
    id: 1,
    name: "Added point",
    description: "",
  };
});

onBeforeRouteLeave(() => {
  if (meta.value.dirty && !submitted.value) {
    // eslint-disable-next-line no-alert
    const confirm = window.confirm(
      "Все не сохраненные изменения исчезнут. Вы уверены, что хотите покинуть страницу?",
    );
    if (!confirm) {
      return false;
    }
  }
  mapStore.addedPoint = null;

  return true;
});
</script>

<template>
  <div
    v-if="submitErrors.submit"
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
    <span>{{ submitErrors.submit }}</span>
  </div>
  <form class="flex flex-col" @submit.prevent="onSubmit">
    <slot :errors="errors" :loading="loading" />
    <div>
      Вы можете добавить место этими способами:
      <ul class="list-disc list-inside ml-4">
        <li>
          Перенесите
          <Icon name="tabler:map-pin-filled" class="text-warning" /> маркер на
          необходимое место и добавьте его.
        </li>
        <li>
          Или двойным нажатием на карту.
        </li>
        <li>
          Или выберите место из списка.
        </li>
      </ul>
    </div>
    <p class="text-xs text-gray-400 mb-4">
      Текущее положение:
      {{ formatNumber(controlledValues.lat) }}

      {{ formatNumber(controlledValues.long) }}
    </p>
    <div class="flex justify-end gap-4">
      <button
        :disabled="loading"
        type="submit"
        class="btn btn-primary"
      >
        <span v-if="loading" class="loading loading-spinner loading-md" />
        <Icon
          v-else
          :name="props.submitButtonIcon || 'tabler:circle-plus-filled'"
          size="24"
        />
        {{ props.submitButtonText || "Добавить" }}
      </button>
      <button :disabled="loading" class="btn btn-outline">
        <Icon
          name="tabler:arrow-left"
          size="24"
          @click="router.back()"
        />
        Отмена
      </button>
    </div>
  </form>
  <div class="divider" />
  <AppSearchLocations @result-selected="onResultSelected" />
</template>
