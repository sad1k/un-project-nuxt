<script lang="ts" setup>
import type { ZodSchema } from "zod";

import { CENTER_RUSSIA } from "~/lib/constants";
import { type InsertLocationLog, InsertLocationLogSchema } from "~/lib/db/schema";

const props = defineProps<{
  initialValues?: InsertLocationLog;
  onSubmit: (values: InsertLocationLog) => Promise<any>;
  submitButtonText?: string;
  submitButtonIcon?: string;
  onSubmitComplete?: () => void;
}>();

const initialValues = computed(() => ({
  startedAt: props.initialValues?.startedAt || Date.now() - (24 * 60 * 60 * 1000),
  endedAt: props.initialValues?.endedAt || Date.now(),
  name: props.initialValues?.name || "",
  description: props.initialValues?.description || "",
  lat: props.initialValues?.lat || CENTER_RUSSIA[1],
  long: props.initialValues?.long || CENTER_RUSSIA[0],
}));
</script>

<template>
  <LocationBaseForm
    v-slot="{ errors, loading }"
    :initial-values="initialValues"
    :on-submit="props.onSubmit"
    :submit-button-text
    :submit-button-icon
    :on-submit-complete
    :schema="InsertLocationLogSchema as unknown as ZodSchema"
  >
    <AppFormField
      name="name"
      :disabled="loading"
      label="Название"
      :error="errors.name"
    />
    <AppFormField
      name="description"
      type="textarea"
      label="Описание"
      :disabled="loading"
      :error="errors.description"
    />
    <AppDateFormField
      name="startedAt"
      label="Начало"
      :disabled="loading"
      :error="errors.startedAt"
      :value="initialValues.startedAt"
    />
    <AppDateFormField
      name="endedAt"
      label="Конец"
      :disabled="loading"
      :error="errors.endedAt"
      :value="initialValues.endedAt"
    />
  </LocationBaseForm>
</template>
