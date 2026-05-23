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

const leaveDialog = ref<HTMLDialogElement | null>(null);
let pendingLeave: ((proceed: boolean) => void) | null = null;

function confirmLeave() {
  pendingLeave?.(true);
  pendingLeave = null;
  leaveDialog.value?.close();
  mapStore.addedPoint = null;
}
function cancelLeave() {
  pendingLeave?.(false);
  pendingLeave = null;
  leaveDialog.value?.close();
}

function focusFirstInvalid() {
  nextTick(() => {
    const root = document.activeElement?.ownerDocument ?? document;
    const firstInvalid = root.querySelector<HTMLElement>("[aria-invalid='true'], .input-error, [data-invalid='true']");
    firstInvalid?.focus();
  });
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
    focusFirstInvalid();
  }
}, () => {
  focusFirstInvalid();
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
    return new Promise<boolean>((resolve) => {
      pendingLeave = resolve;
      leaveDialog.value?.showModal();
    });
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
  <form class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-2xl shadow-black/10 backdrop-blur-sm sm:p-6 dark:border-white/10 dark:bg-white/5" @submit.prevent="onSubmit">
    <slot :errors="errors" :loading="loading" />
    <p class="text-xs leading-relaxed text-gray-500 dark:text-white/50">
      Перенесите маркер на карте, дважды коснитесь карты, или выберите место из списка ниже.
    </p>
    <p class="text-xs text-gray-500 dark:text-white/40">
      Текущее положение:
      {{ formatNumber(controlledValues.lat) }}

      {{ formatNumber(controlledValues.long) }}
    </p>
    <div class="hidden md:flex justify-end gap-4">
      <button
        :disabled="loading"
        type="submit"
        class="btn border-none bg-brand-gold text-brand-dark hover:bg-white"
      >
        <span v-if="loading" class="loading loading-spinner loading-md" />
        <Icon
          v-else
          :name="props.submitButtonIcon || 'tabler:circle-plus-filled'"
          size="24"
        />
        {{ props.submitButtonText || "Добавить" }}
      </button>
      <button :disabled="loading" class="btn border-gray-300 bg-transparent text-gray-800 hover:border-gray-400 hover:bg-gray-100 dark:border-white/20 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10">
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
  <dialog ref="leaveDialog" class="modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Покинуть форму?</h3>
      <p class="py-2 text-sm text-gray-600 dark:text-white/70">
        Все несохранённые изменения будут потеряны.
      </p>
      <div class="modal-action">
        <button type="button" class="btn btn-error" @click="confirmLeave">Покинуть</button>
        <button type="button" class="btn" @click="cancelLeave">Остаться</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button type="button" @click="cancelLeave">Закрыть</button></form>
  </dialog>
  <Teleport to="body">
    <div class="app-chrome-strong fixed inset-x-0 bottom-16 z-40 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
      <button
        :disabled="loading"
        type="button"
        class="btn w-full border-none bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30 active:scale-[0.98]"
        @click="onSubmit"
      >
        <span v-if="loading" class="loading loading-spinner loading-md" />
        <Icon v-else :name="props.submitButtonIcon || 'tabler:circle-plus-filled'" size="22" />
        {{ props.submitButtonText || "Добавить" }}
      </button>
      <button type="button" class="mt-2 block w-full text-center text-sm text-gray-500 active:text-gray-700 dark:text-white/60" @click="router.back()">
        Отмена
      </button>
    </div>
  </Teleport>
</template>
