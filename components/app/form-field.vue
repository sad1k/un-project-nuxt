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
    <legend class="fieldset-legend text-gray-700 dark:text-white/70">
      {{ props.label }}
    </legend>
    <Field
      :as="type === 'textarea' ? 'textarea' : undefined"
      class="w-full border-gray-200 bg-white/80 text-gray-950 placeholder:text-gray-400 focus:border-brand-gold focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40"
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
