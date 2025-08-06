<template>
  <div class="min-h-screen bg-gradient-to-br from-green-600 via-green-700 to-green-800 p-2 sm:p-4">
    <div class="max-w-7xl mx-auto">
      
      <!-- Game Header -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-4">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-gray-800">🃏 Pouilleux</h1>
            <p class="text-sm text-gray-600">Code: {{ gameStore.roomCode }}</p>
          </div>
          
          <div class="flex items-center space-x-4">
            <!-- Turn indicator -->
            <div v-if="gameStore.gameState === 'playing'" class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full" :class="gameStore.isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-300'"></div>
              <span class="text-sm font-medium">
                {{ gameStore.isMyTurn ? 'Votre tour' : `Tour de ${gameStore.currentPlayer?.name}` }}
              </span>
            </div>
            
            <button
              @click="leaveGame"
              class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-sm rounded-md transition-colors"
            >
              Quitter
            </button>
          </div>
        </div>
      </div>

      <!-- Game State: Playing -->
      <div v-if="gameStore.gameState === 'playing'" class="space-y-4">
        
        <!-- Other Players (arranged in circle) -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4">
          <h2 class="text-lg font-semibold mb-4 text-center">Autres joueurs</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div
              v-for="player in otherPlayers"
              :key="player.id"
              class="bg-gray-50 rounded-lg p-3 text-center transition-all cursor-pointer"
              :class="{
                'ring-2 ring-blue-500 bg-blue-50 hover:bg-blue-100': gameStore.nextPlayer && player.id === gameStore.nextPlayer.id && gameStore.isMyTurn,
                'ring-2 ring-green-500 bg-green-50': player.id === gameStore.currentPlayer?.id,
                'opacity-50 cursor-not-allowed': player.cardCount === 0 || !gameStore.isMyTurn,
                'hover:bg-gray-100': gameStore.isMyTurn && gameStore.nextPlayer && player.id === gameStore.nextPlayer.id
              }"
              @click="selectTargetPlayer(player)"
            >
              <div class="flex flex-col items-center space-y-2">
                <span class="font-medium text-sm">{{ player.name }}</span>
                <div class="text-xs text-gray-500">{{ player.cardCount }} carte(s)</div>
                <div class="text-xs text-gray-500">{{ player.pairCount }} paire(s)</div>
                
                <!-- Click indicator -->
                <div v-if="gameStore.isMyTurn && gameStore.nextPlayer && player.id === gameStore.nextPlayer.id" 
                     class="text-xs text-blue-600 font-medium">
                  👆 Cliquez pour piocher
                </div>
                
                <!-- Cards visualization -->
                <div class="flex flex-wrap justify-center gap-1">
                  <div
                    v-for="n in Math.min(player.cardCount, 8)"
                    :key="n"
                    class="w-3 h-4 bg-blue-600 rounded-sm shadow-sm"
                    :style="{ transform: `rotate(${(n-1) * 5}deg)` }"
                  ></div>
                  <span v-if="player.cardCount > 8" class="text-xs text-gray-400">...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- My Cards -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Mes cartes ({{ gameStore.myCards.length }})</h2>
            <div class="text-sm text-gray-600">Paires formées: {{ myPairs.length }}</div>
          </div>
          
          <div class="space-y-4">
            <!-- My pairs -->
            <div v-if="myPairs.length > 0">
              <h3 class="text-sm font-medium text-gray-700 mb-2">Mes paires:</h3>
              <div class="flex flex-wrap gap-2">
                <div 
                  v-for="(pair, index) in myPairs"
                  :key="index"
                  class="flex space-x-1 bg-green-50 rounded-lg p-2"
                >
                  <PlayingCard
                    v-for="card in pair"
                    :key="`${card.suit}-${card.value}`"
                    :card="card"
                    class="scale-75"
                  />
                </div>
              </div>
            </div>

            <!-- My current cards -->
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Cartes en main:</h3>
              <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
                <PlayingCard
                  v-for="card in gameStore.myCards"
                  :key="`${card.suit}-${card.value}`"
                  :card="card"
                  :isNew="isNewCard(card)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Game Log -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4">
          <h2 class="text-lg font-semibold mb-3">Historique du jeu</h2>
          <div class="h-32 overflow-y-auto space-y-1">
            <div
              v-for="(log, index) in gameStore.gameLog"
              :key="index"
              class="text-sm text-gray-700 py-1 px-2 rounded bg-gray-50"
            >
              <span class="text-xs text-gray-500">{{ formatTime(log.timestamp) }}</span>
              - {{ log.message }}
            </div>
          </div>
        </div>

        <!-- Action Instruction -->
        <div v-if="gameStore.isMyTurn" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p class="text-yellow-800 font-medium">🎯 C'est votre tour ! Cliquez sur {{ gameStore.nextPlayer?.name }} pour piocher une carte.</p>
        </div>
      </div>

      <!-- Card Selection Modal -->
      <div v-if="showCardSelection" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-gray-800">Choisissez une carte</h3>
            <p class="text-gray-600 mt-2">Piochez une carte chez {{ selectedTargetPlayer?.name }}</p>
          </div>
          
          <!-- Back of cards to choose from -->
          <div class="flex flex-wrap justify-center gap-3 mb-6">
            <div
              v-for="(card, index) in Array(selectedTargetPlayer?.cardCount || 0)"
              :key="index"
              class="cursor-pointer transform transition-all hover:scale-105 hover:-translate-y-2"
              @click="drawCardAtIndex(index)"
            >
              <div class="w-16 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg shadow-lg border-2 border-white flex items-center justify-center">
                <div class="text-white font-bold text-xs">{{ index + 1 }}</div>
              </div>
            </div>
          </div>
          
          <div class="text-center text-sm text-gray-500 mb-4">
            Les cartes ne sont pas triées - choisissez au hasard !
          </div>
          
          <div class="flex space-x-3 justify-center">
            <button
              @click="cancelCardSelection"
              class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>

      <!-- Game State: Finished -->
      <div v-else-if="gameStore.gameState === 'finished'" class="text-center">
        <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-8">
          <div class="space-y-6">
            <div v-if="gameStore.winner">
              <h2 class="text-3xl font-bold text-green-600 mb-2">🎉 Partie terminée !</h2>
              <p class="text-xl text-gray-700">{{ gameStore.winner.name }} a gagné !</p>
            </div>
            
            <div v-if="loser" class="bg-red-50 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-red-800 mb-2">😱 Le Pouilleux était chez :</h3>
              <p class="text-xl text-red-600 font-bold">{{ loser.name }}</p>
            </div>

            <div class="space-y-2">
              <h3 class="text-lg font-semibold text-gray-700">Classement final :</h3>
              <div class="space-y-1">
                <div
                  v-for="(player, index) in finalRanking"
                  :key="player.id"
                  class="flex items-center justify-between p-2 rounded"
                  :class="player.hasLost ? 'bg-red-100' : 'bg-green-100'"
                >
                  <div class="flex items-center space-x-2">
                    <span class="font-bold">{{ index + 1 }}.</span>
                    <span>{{ player.name }}</span>
                    <span v-if="player.hasLost" class="text-red-600 text-sm">(Pouilleux)</span>
                  </div>
                  <span class="text-sm text-gray-600">{{ player.pairCount }} paires</span>
                </div>
              </div>
            </div>

            <div class="flex space-x-4 justify-center">
              <button
                @click="$router.push('/lobby')"
                class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
              >
                🔄 Nouvelle partie
              </button>
              <button
                @click="$router.push('/')"
                class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
              >
                🏠 Accueil
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <div v-if="gameStore.error" class="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
        <p class="text-red-700 text-sm">{{ gameStore.error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import PlayingCard from '../components/PlayingCard.vue'

const router = useRouter()
const gameStore = useGameStore()

const newlyDrawnCard = ref(null)
const showCardSelection = ref(false)
const selectedTargetPlayer = ref(null)

const otherPlayers = computed(() => {
  return gameStore.players.filter(p => p.id !== gameStore.playerId)
})

const myPairs = computed(() => {
  return gameStore.myPairs || []
})

const loser = computed(() => {
  return gameStore.players.find(p => p.hasLost) || null
})

const finalRanking = computed(() => {
  return [...gameStore.players].sort((a, b) => {
    if (a.hasLost && !b.hasLost) return 1
    if (!a.hasLost && b.hasLost) return -1
    return b.pairCount - a.pairCount
  })
})

const isNewCard = (card) => {
  return newlyDrawnCard.value && 
         newlyDrawnCard.value.suit === card.suit && 
         newlyDrawnCard.value.value === card.value
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const selectTargetPlayer = (player) => {
  if (!gameStore.isMyTurn) return
  if (!gameStore.nextPlayer || player.id !== gameStore.nextPlayer.id) return
  if (player.cardCount === 0) return
  
  selectedTargetPlayer.value = player
  showCardSelection.value = true
}

const drawCardAtIndex = (cardIndex) => {
  gameStore.drawCard(cardIndex)
  cancelCardSelection()
}

const cancelCardSelection = () => {
  showCardSelection.value = false
  selectedTargetPlayer.value = null
}

const drawCard = (targetPlayerId) => {
  if (!gameStore.isMyTurn) return
  
  gameStore.drawCard(targetPlayerId)
}

const leaveGame = () => {
  gameStore.disconnect()
  router.push('/')
}

// Watch for newly drawn cards
watch(() => gameStore.lastAction, (action) => {
  if (action && action.type === 'draw' && action.cardDrawn) {
    newlyDrawnCard.value = action.cardDrawn
    setTimeout(() => {
      newlyDrawnCard.value = null
    }, 2000)
  }
}, { deep: true })

onMounted(() => {
  // Redirect if not in a game
  if (!gameStore.roomCode || gameStore.gameState === 'lobby') {
    router.push('/lobby')
  }
})
</script>
