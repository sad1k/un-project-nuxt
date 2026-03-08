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
    class="absolute left-4 top-20 bottom-4 z-20 transition-all duration-300"
    :class="collapsed ? 'w-3.5' : 'w-[380px]'"
  >
    <!-- Collapsed strip -->
    <button
      v-if="collapsed"
      class="w-full h-full bg-white/60 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white/80 transition-colors"
      @click="collapsed = false"
    >
      <Icon name="tabler:chevron-right" size="16" class="text-gray-600" />
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      class="h-full bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 overflow-y-auto"
    >
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <h2 class="font-bold text-lg text-gray-800">Route Generator</h2>
          <p class="text-xs text-gray-400">AI-powered itinerary</p>
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          @click="collapsed = true"
        >
          <Icon name="tabler:chevron-left" size="16" class="text-gray-500" />
        </button>
      </div>

      <!-- Destination input -->
      <div class="relative mb-5">
        <Icon
          name="tabler:map-pin"
          size="18"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          v-model="destination"
          placeholder="Where to?"
          class="pl-10 pr-4 py-3 w-full bg-white/60 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
        >
      </div>

      <!-- Duration selector -->
      <div class="mb-5">
        <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Duration</label>
        <div class="flex gap-2">
          <button
            v-for="d in durations"
            :key="d"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-all"
            :class="selectedDays === d
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="selectedDays = d"
          >
            {{ d }}d
          </button>
        </div>
      </div>

      <!-- Interest tags -->
      <div class="mb-5">
        <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Interests</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="interest in interests"
            :key="interest.label"
            class="px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all flex items-center gap-1"
            :class="selectedInterests.has(interest.label)
              ? 'ring-2 ring-amber-400 bg-amber-50'
              : 'bg-gray-100 hover:bg-gray-200'"
            @click="toggleInterest(interest.label)"
          >
            <span>{{ interest.emoji }}</span>
            <span>{{ interest.label }}</span>
          </button>
        </div>
      </div>

      <!-- Quick stats -->
      <div v-if="points.length > 0" class="grid grid-cols-3 gap-3 mb-5">
        <div class="text-center p-2 bg-white/50 rounded-lg">
          <Icon name="tabler:clock" size="16" class="text-amber-500 mx-auto mb-1" />
          <div class="text-sm font-semibold text-gray-700">~{{ stats.estimatedHours }}h</div>
        </div>
        <div class="text-center p-2 bg-white/50 rounded-lg">
          <Icon name="tabler:map-pin" size="16" class="text-amber-500 mx-auto mb-1" />
          <div class="text-sm font-semibold text-gray-700">{{ stats.placeCount }} places</div>
        </div>
        <div class="text-center p-2 bg-white/50 rounded-lg">
          <Icon name="tabler:target" size="16" class="text-amber-500 mx-auto mb-1" />
          <div class="text-sm font-semibold text-gray-700">{{ stats.matchPercentage }}%</div>
        </div>
      </div>

      <!-- Generate button -->
      <button
        class="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-400 to-orange-500 hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
