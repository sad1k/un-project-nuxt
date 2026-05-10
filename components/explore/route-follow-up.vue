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
      class="text-sm font-semibold text-gray-900"
      for="route-follow-up"
    >
      Refine route
    </label>
    <div class="flex gap-2">
      <input
        id="route-follow-up"
        v-model="followUpMessage"
        class="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-900"
        placeholder="Change a wish or replace a point"
        type="text"
      >
      <button
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
