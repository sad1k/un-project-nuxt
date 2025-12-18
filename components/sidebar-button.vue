<script lang="ts" setup>
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{
  label: string;
  icon: string;
  href?: string;
  showLabel: boolean;
  iconColor?: "text-accent" | "text-primary" | "text-secondary";
  to?: RouteLocationRaw;
}>();
const route = useRoute();
</script>

<template>
  <div
    class="tooltip-right"
    :data-tip="props.showLabel ? undefined : props.label"
    :class="{ tooltip: !props.showLabel }"
  >
    <NuxtLink
      :to="props.to"
      :href="props.href"
      :class="{
        'bg-gray-100 text-brand-sangria border-r-2 border-brand-sangria dark:bg-white/5 dark:text-brand-gold dark:border-brand-gold': route.path === props.href,
        'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5': route.path !== props.href,
        'justify-center': !props.showLabel,
        'justify-start': props.showLabel,
      }"
      class="flex w-full gap-3 p-3 transition-all duration-200 items-center"
    >
      <Icon
        :name="props.icon"
        size="24"
        :class="`${iconColor} shrink-0`"
      />
      <Transition name="grow">
        <span v-if="props.showLabel" class="truncate font-body text-sm tracking-wide">
          {{ props.label }}
        </span>
      </Transition>
    </NuxtLink>
  </div>
</template>

<style scoped>
.grow-enter-active {
  animation: grow 0.1s;
}
.grow-leave-active {
  animation: grow 0.1s reverse;
}
@keyframes grow {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}
</style>
