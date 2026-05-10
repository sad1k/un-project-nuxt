<script lang="ts" setup>
const { activeVariantId, pointsByVariantId, setActiveVariant, variants } = useAiRouteSession();
</script>

<template>
  <section
    v-if="variants.length"
    class="space-y-2"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-900">
        Route history
      </h3>
      <span class="text-xs text-gray-500">{{ variants.length }} variants</span>
    </div>

    <div class="space-y-2">
      <button
        v-for="variant in variants"
        :key="variant.id"
        class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition"
        :class="variant.id === activeVariantId ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'"
        type="button"
        @click="setActiveVariant(variant.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium">
            {{ variant.title || `Route ${variant.id}` }}
          </span>
          <span class="block text-xs opacity-70">
            {{ pointsByVariantId[variant.id]?.length || variant.pointCount }} points · {{ variant.status }}
          </span>
        </span>
        <Icon
          v-if="variant.id === activeVariantId"
          name="tabler:check"
          size="16"
        />
      </button>
    </div>
  </section>
</template>
