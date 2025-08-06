<template>
  <div v-if="targetCards" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold mb-4 text-center">
        Choisissez une carte chez {{ targetCards.targetPlayerName }}
      </h3>
      
      <div class="grid grid-cols-5 gap-2 mb-6">
        <button
          v-for="index in targetCards.cardCount"
          :key="index"
          @click="selectCard(index - 1)"
          class="aspect-[3/4] bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center text-sm font-medium shadow-md"
        >
          {{ index }}
        </button>
      </div>
      
      <div class="flex gap-2">
        <button
          @click="$emit('cancel')"
          class="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineEmits } from 'vue'

const props = defineProps({
  targetCards: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['select-card', 'cancel'])

const selectCard = (cardIndex) => {
  emit('select-card', cardIndex)
}
</script>
