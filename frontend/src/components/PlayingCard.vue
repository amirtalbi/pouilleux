<template>
  <div 
    class="playing-card relative cursor-pointer transition-all duration-300 hover:scale-105"
    :class="[
      'w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-32',
      {
        'animate-bounce-in': isNew,
        'animate-card-flip': isFlipping,
        'border-2 border-yellow-400 shadow-yellow-300 shadow-lg': isPouilleux,
        'opacity-50': isDrawing
      }
    ]"
    @click="$emit('click')"
  >
    <div class="card-face front bg-white border-2 border-gray-300 rounded-lg shadow-md flex flex-col justify-between p-1 sm:p-2 h-full">
      <!-- Coin supérieur gauche -->
      <div class="flex flex-col items-center text-xs sm:text-sm">
        <span :class="cardColor" class="font-bold">{{ displayValue }}</span>
        <span 
          class="text-xs sm:text-sm"
          v-html="suitSymbol"
          :class="cardColor"
        ></span>
      </div>
      
      <!-- Centre de la carte -->
      <div class="flex-1 flex items-center justify-center">
        <span 
          class="text-2xl sm:text-3xl md:text-4xl"
          v-html="suitSymbol"
          :class="cardColor"
        ></span>
      </div>
      
      <!-- Coin inférieur droit (inversé) -->
      <div class="flex flex-col items-center text-xs sm:text-sm transform rotate-180">
        <span :class="cardColor" class="font-bold">{{ displayValue }}</span>
        <span 
          class="text-xs sm:text-sm"
          v-html="suitSymbol"
          :class="cardColor"
        ></span>
      </div>

      <!-- Indicateur Pouilleux -->
      <div v-if="isPouilleux" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded transform -rotate-12 shadow-lg">
          POUILLEUX !
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  isNew: {
    type: Boolean,
    default: false
  },
  isDrawing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const isFlipping = ref(false)

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦', 
  clubs: '♣',
  spades: '♠',
  joker: '🃏'  // Symbole spécial pour le Joker
}

const suitSymbol = computed(() => suitSymbols[props.card.suit] || '?')

const cardColor = computed(() => {
  // Le Joker a une couleur spéciale
  if (props.card.suit === 'joker') {
    return 'text-purple-600'
  }
  return props.card.suit === 'hearts' || props.card.suit === 'diamonds' 
    ? 'text-red-500' 
    : 'text-black'
})

const displayValue = computed(() => {
  if (props.card.suit === 'joker') {
    return 'JOKER'
  }
  switch (props.card.value) {
    case 'A': return 'A'
    case 'J': return 'V'
    case 'Q': return 'D'
    case 'K': return 'R'
    default: return props.card.value
  }
})

const isPouilleux = computed(() => {
  // Seul le Joker est le Pouilleux (défini par isPouilleux: true)
  return props.card.isPouilleux === true
})

// Animation lors du changement de carte
watch(() => props.card, () => {
  isFlipping.value = true
  setTimeout(() => {
    isFlipping.value = false
  }, 600)
}, { deep: true })
</script>

<style scoped>
.playing-card {
  perspective: 1000px;
}

.card-face {
  backface-visibility: hidden;
  transition: transform 0.6s;
}

.animate-card-flip {
  animation: cardFlip 0.6s ease-in-out;
}

@keyframes cardFlip {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(-90deg); }
  100% { transform: rotateY(0deg); }
}

.animate-bounce-in {
  animation: bounceIn 0.6s ease-out;
}

@keyframes bounceIn {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); opacity: 0.8; }
  70% { transform: scale(0.9); opacity: 0.9; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
