<script lang="ts" setup>
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{
  label: string;
  icon: string;
  href?: string;
  showLabel: boolean;
  iconColor?: string;
  to?: RouteLocationRaw;
}>();
const route = useRoute();

const target = computed(() => props.to || props.href || "#");
const targetPath = computed(() => props.href || (typeof props.to === "string" ? props.to : undefined));
</script>

<template>
  <div
    class="tooltip-right"
    :data-tip="props.showLabel ? undefined : props.label"
    :class="{ tooltip: !props.showLabel }"
  >
    <NuxtLink
      :to="target"
      :class="{
        'bg-white/10 text-brand-gold border-r-2 border-brand-gold shadow-inner shadow-white/5': targetPath && route.path === targetPath,
        'text-white/45 hover:text-white hover:bg-white/5': !targetPath || route.path !== targetPath,
        'justify-center': !props.showLabel,
        'justify-start': props.showLabel,
      }"
      class="group flex w-full items-center gap-3 p-3 transition-all duration-300"
    >
      <Icon
        :name="props.icon"
        size="24"
        :class="`${iconColor} shrink-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-3`"
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
