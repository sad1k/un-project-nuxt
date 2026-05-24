<script lang="ts" setup>
const { activeVariantId, isGenerating, sessionId, submitFollowUp } = useAiRouteSession();
const followUpMessage = ref("");

const canSubmit = computed(() => Boolean(
  sessionId.value
  && activeVariantId.value
  && followUpMessage.value.trim()
  && !isGenerating.value,
));

async function submit() {
  if (!canSubmit.value)
    return;

  const message = followUpMessage.value;
  followUpMessage.value = "";
  await submitFollowUp(message);
}
</script>

<template>
  <form
    v-if="sessionId"
    class="space-y-2"
    @submit.prevent="submit"
  >
    <label
      class="text-sm font-semibold text-[var(--explore-text)]"
      for="route-follow-up"
    >
      Уточнить маршрут
    </label>
    <div class="flex gap-2">
      <input
        id="route-follow-up"
        v-model="followUpMessage"
        class="explore-input min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm transition focus:border-brand-gold/50"
        placeholder="Измените пожелание или замените точку"
        type="text"
      >
      <button
        class="explore-primary-button flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canSubmit"
        type="submit"
      >
        <Icon
          v-if="isGenerating"
          class="animate-spin"
          name="tabler:loader-2"
          size="16"
        />
        <Icon
          v-else
          name="tabler:send"
          size="16"
        />
      </button>
    </div>
  </form>
</template>
