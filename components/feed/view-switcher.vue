<script lang="ts" setup>
const route = useRoute();

const tabs = [
  {
    key: "feed",
    label: "Лента",
    icon: "tabler:list-details",
    to: { path: "/feed" },
  },
  {
    key: "globe",
    label: "Лайф глобус",
    icon: "tabler:world",
    to: { path: "/feed", query: { tab: "globe" } },
  },
] as const;

const activeTab = computed(() => route.query.tab === "globe" ? "globe" : "feed");
</script>

<template>
  <nav class="feed-tab-switcher" aria-label="Режим ленты">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :aria-label="tab.label"
      class="feed-tab-button"
      :class="{ 'feed-tab-button--active': activeTab === tab.key }"
      :to="tab.to"
    >
      <Icon :name="tab.icon" size="20" />
      <span class="feed-tab-label">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.feed-tab-switcher {
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.dark .feed-tab-switcher {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(5, 5, 5, 0.54);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.28);
}

.feed-tab-button {
  display: inline-flex;
  width: 2.75rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  color: rgba(71, 85, 105, 0.9);
  outline: none;
  transition:
    width 240ms ease,
    background-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
}

.dark .feed-tab-button {
  color: rgba(255, 255, 255, 0.62);
}

.feed-tab-button:hover,
.feed-tab-button:focus-visible {
  width: 8.75rem;
  color: #0f172a;
}

.dark .feed-tab-button:hover,
.dark .feed-tab-button:focus-visible {
  color: white;
}

.feed-tab-button--active {
  background: #f6c453;
  color: #111827;
  box-shadow: 0 10px 28px rgba(246, 196, 83, 0.25);
}

.feed-tab-label {
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition:
    max-width 240ms ease,
    opacity 160ms ease;
}

.feed-tab-button:hover .feed-tab-label,
.feed-tab-button:focus-visible .feed-tab-label {
  max-width: 6.75rem;
  opacity: 1;
}

@media (max-width: 420px) {
  .feed-tab-button:hover,
  .feed-tab-button:focus-visible {
    width: 7.25rem;
  }
}
</style>
