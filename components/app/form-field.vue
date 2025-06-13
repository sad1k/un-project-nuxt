<script lang="ts" setup>
const props = defineProps<{
  error?: string;
  name: string;
  label: string;
  type?: "text" | "textarea" | "number";
  disabled?: boolean;
}>();
</script>

<template>
  <fieldset class="fieldset">
    <legend class="fieldset-legend">
      {{ props.label }}
    </legend>
    <Field
      :as="type === 'textarea' ? 'textarea' : undefined"
      class="w-full"
      :name="props.name"
      :disabled="disabled"
      :type="props.type || 'text'"
      :class="{ 'input-error': props.error, 'input': !props.type || props.type === 'text' || props.type === 'number', 'textarea': props.type === 'textarea' }"
    />
    <p v-if="props.error" class="fieldset-label text-error">
      {{ props.error }}
    </p>
  </fieldset>
</template>
