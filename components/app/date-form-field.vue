<script lang="ts" setup>
const props = defineProps<{
  error?: string;
  name: string;
  value?: number;
  label: string;
  type?: "text" | "textarea" | "number";
  disabled?: boolean;
}>();

const { handleBlur, value: inputValue, handleChange } = useField<number>(props.name, {
  initialValue: props.value,
});

function handleDateChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const date = new Date(target.value);
  handleChange(date.getTime());
}
</script>

<template>
  <fieldset class="fieldset">
    <legend class="fieldset-legend">
      {{ props.label }}
    </legend>
    <input
      class="w-full"
      :name="props.name"
      :disabled="disabled"
      type="date"
      :class="{ 'input-error': props.error, 'input': !props.type || props.type === 'text' || props.type === 'number', 'textarea': props.type === 'textarea' }"
      :value="formatDate(inputValue)"
      @blur="handleBlur"
      @change="handleDateChange"
    >
    <p v-if="props.error" class="fieldset-label text-error">
      {{ props.error }}
    </p>
  </fieldset>
</template>
