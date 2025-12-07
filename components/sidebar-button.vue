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
      :class="{ 'bg-base-300': route.path === props.href, 'justify-center': !props.showLabel, 'justify-start': props.showLabel }"
      class="flex w-full gap-2 p-2 hover:bg-base-300 hover:cursor-pointer flex-nowrap"
    >
      <Icon
        :name="props.icon"
        size="24"
        :class="`${iconColor} shrink-0`"
      />
      <Transition name="grow">
        <span v-if="props.showLabel" class="truncate">
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
