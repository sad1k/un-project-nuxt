<script lang="ts" setup>
const { destination, selectedDays, selectedInterests, points, generating, stats, generate } = useRouteGenerator()

const collapsed = ref(false)

const durations = [3, 5, 7, 10, 14]
const interests = [
  { emoji: '🏛', label: 'Culture' },
  { emoji: '🍜', label: 'Food' },
  { emoji: '🌿', label: 'Nature' },
  { emoji: '⛰️', label: 'Adventure' },
  { emoji: '🎨', label: 'Art' },
  { emoji: '🌙', label: 'Nightlife' },
]

function toggleInterest(label: string) {
  if (selectedInterests.value.has(label)) {
    selectedInterests.value.delete(label)
  }
  else {
    selectedInterests.value.add(label)
  }
}
</script>

<template>
  <div
    class="absolute right-4 top-20 bottom-4 z-20 transition-all duration-300"
    :class="collapsed ? 'w-3.5' : 'w-[380px]'"
  >
    <!-- Collapsed strip -->
    <button
      v-if="collapsed"
      class="w-full h-full bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
      @click="collapsed = false"
    >
      <Icon name="tabler:chevron-left" size="16" class="text-white/60" />
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      class="h-full bg-brand-dark/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 overflow-y-auto"
    >
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="font-bold text-lg text-white">Route Generator</h2>
          <p class="text-xs text-white/40">AI-powered itinerary</p>
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          @click="collapsed = true"
        >
          <Icon name="tabler:chevron-right" size="16" class="text-white/50" />
        </button>
      </div>

      <!-- Destination input -->
      <div class="relative mb-5">
        <Icon
          name="tabler:map-pin"
          size="18"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
        />
        <input
          v-model="destination"
          placeholder="Where to?"
          class="pl-10 pr-4 py-3 w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-emerald/50 focus:border-brand-emerald transition-all"
        >
      </div>

      <!-- Duration selector -->
      <div class="mb-5">
        <label class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Duration</label>
        <div class="flex gap-2">
          <button
            v-for="d in durations"
            :key="d"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-all"
            :class="selectedDays === d
              ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'"
            @click="selectedDays = d"
          >
            {{ d }}d
          </button>
        </div>
      </div>

      <!-- Interest tags -->
      <div class="mb-5">
        <label class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Interests</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="interest in interests"
            :key="interest.label"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all flex items-center gap-1"
            :class="selectedInterests.has(interest.label)
              ? 'ring-2 ring-brand-gold bg-brand-gold/10 text-brand-gold'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'"
            @click="toggleInterest(interest.label)"
          >
            <span>{{ interest.emoji }}</span>
            <span>{{ interest.label }}</span>
          </button>
        </div>
      </div>

      <!-- Quick stats -->
      <div v-if="points.length > 0" class="grid grid-cols-3 gap-3 mb-5">
        <div class="text-center p-2 bg-white/5 rounded-lg border border-white/10">
          <Icon name="tabler:clock" size="16" class="text-brand-gold mx-auto mb-1" />
          <div class="text-sm font-semibold text-white">~{{ stats.estimatedHours }}h</div>
        </div>
        <div class="text-center p-2 bg-white/5 rounded-lg border border-white/10">
          <Icon name="tabler:map-pin" size="16" class="text-brand-gold mx-auto mb-1" />
          <div class="text-sm font-semibold text-white">{{ stats.placeCount }} places</div>
        </div>
        <div class="text-center p-2 bg-white/5 rounded-lg border border-white/10">
          <Icon name="tabler:target" size="16" class="text-brand-gold mx-auto mb-1" />
          <div class="text-sm font-semibold text-white">{{ stats.matchPercentage }}%</div>
        </div>
      </div>

      <!-- Generate button -->
      <button
        class="w-full py-3 rounded-xl font-bold text-white bg-brand-emerald hover:bg-brand-emerald/80 hover:shadow-lg hover:shadow-brand-emerald/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="generating"
        @click="generate()"
      >
        <span v-if="generating" class="flex items-center justify-center gap-2">
          <Icon name="tabler:loader-2" size="18" class="animate-spin" />
          Generating...
        </span>
        <span v-else>
          {{ points.length > 0 ? 'Regenerate' : 'Generate Route' }}
        </span>
      </button>
    </div>
  </div>
</template>
