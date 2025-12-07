<script lang="ts" setup>
import type { ZodSchema } from "zod";

import { CENTER_RUSSIA } from "~/lib/constants";
import { type InsertLocation, InsertLocationSchema } from "~/lib/db/schema";

const props = defineProps<{
  initialValues?: InsertLocation;
  onSubmit: (values: InsertLocation) => Promise<any>;
  submitButtonText?: string;
  submitButtonIcon?: string;
  onSubmitComplete?: () => void;
}>();
</script>

<template>
  <LocationBaseForm
    v-slot="{ errors, loading }"
    :initial-values="props.initialValues || { name: '', description: '', lat: CENTER_RUSSIA[1], long: CENTER_RUSSIA[0] }"
    :on-submit="props.onSubmit"
    :submit-button-text
    :submit-button-icon
    :on-submit-complete
    :schema="InsertLocationSchema as unknown as ZodSchema"
  >
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
  </LocationBaseForm>
</template>
