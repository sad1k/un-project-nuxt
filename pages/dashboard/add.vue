<script lang="ts" setup>
import type { FetchError } from "ofetch";

import { toTypedSchema } from "@vee-validate/zod";

import { CENTER_RUSSIA } from "~/lib/constants";
import { InsertLocation as InsertLocationSchema } from "~/lib/db/schema";

// Define types for reactive variables
const submitError = ref<string>("");
const loading = ref<boolean>(false);
const submitted = ref<boolean>(false);

const mapStore = useMapStore();

const {
  handleSubmit,
  errors,
  meta,
  setErrors,
  setFieldValue,
  controlledValues,
} = useForm({
  validationSchema: toTypedSchema(InsertLocationSchema),
  initialValues: {
    name: "",
    description: "",
    lat: CENTER_RUSSIA[1],
    long: CENTER_RUSSIA[0],
  },
});

const { $csrfFetch } = useNuxtApp();
const router = useRouter();

function formatNumber(value?: number) {
  if (!value)
    return 0;
  return value.toFixed(5);
}

const onSubmit = handleSubmit(async (values) => {
  try {
    loading.value = true;
    await $csrfFetch("/api/locations", {
      method: "post",
      body: values,
    });
    submitted.value = true;
    navigateTo("/dashboard");
  }
  catch (e) {
    const error = e as FetchError;
    if (error.data?.data) {
      setErrors(error.data?.data);
    }
    submitError.value
      = error.data?.statusMessage || error.statusMessage || "Неизвестная ошибка";
  }
  finally {
    loading.value = false;
  }
});

// function updateAddedPoint(location: SearchLocation) {
//   if (mapStore.addedPoint) {
//     const lat = Number.parseFloat(location.lat);
//     const lon = Number.parseFloat(location.lon);
//     setFieldValue("long", lon);
//     setFieldValue("lat", lat);
//     mapStore.addedPoint.lat = lat;
//     mapStore.addedPoint.long = lon;
//     mapStore.flyToPoint = {
//       ...mapStore.addedPoint,
//       lat,
//       long: lon,
//     };
//   }
// }

effect(() => {
  if (mapStore.addedPoint) {
    setFieldValue("long", mapStore.addedPoint.long);
    setFieldValue("lat", mapStore.addedPoint.lat);
  }
});

onMounted(() => {
  mapStore.addedPoint = {
    lat: CENTER_RUSSIA[1],
    long: CENTER_RUSSIA[0],
    name: "Added point",
    description: "",
    id: 1,
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
  <div class="container max-w-md mx-auto mt-4 p-4">
    <div class="my-4">
      <h1 class="textk-lg">
        Добавить место
      </h1>
      <p class="text-sm">
        Здесь вы можете добавить место, которое вы посетили. Это поможет вам
        запомнить ваш путь и поделиться им с другими. Просто нажмите на кнопку
        "Добавить место" и заполните необходимую информацию. После этого ваше
        место будет добавлено в вашу ленту историй.
      </p>
    </div>

    <div
      v-if="submitError"
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
      <span>{{ submitError }}</span>
    </div>

    <form class="flex flex-col" @submit.prevent="onSubmit">
      <AppFormField
        name="name"
        :disabled="loading"
        label="Имя"
        :error="errors.name"
      />
      <AppFormField
        name="description"
        type="textarea"
        label="Описание"
        :disabled="loading"
        :error="errors.description"
      />

      <p>
        Перенесите
        <Icon name="tabler:map-pin-filled" class="text-warning" /> маркер на
        необходимое место и добавьте его.
      </p>
      <p>Или двойным нажатием на карту.</p>

      <p class="text-xs text-gray-400">
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
            name="tabler:circle-plus-filled"
            size="24"
          />
          Добавить
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
  </div>
</template>
