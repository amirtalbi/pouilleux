<template>
  <div class="game-container">
    <!-- Header -->
    <div class="flex justify-between items-center p-4 bg-white/10 backdrop-blur-md">
      <div class="flex items-center space-x-4">
        <h1 class="text-2xl font-bold text-white">🃏 Pouilleux</h1>
        <div class="bg-white/20 px-3 py-1 rounded-full">
          <span class="text-white text-sm">Salle: {{ roomCode }}</span>
        </div>
      </div>
      
      <div class="flex items-center space-x-4">
        <div v-if="gameStore.isConnected" class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-white text-sm">Connecté</span>
        </div>
        <button
          @click="joinRoomManually"
          class="btn-secondary text-sm"
        >
          🏠 Retour
        </button>
      </div>
    </div>

    <!-- Game content -->
    <div class="flex-1 flex flex-col p-4 space-y-4">
      <!-- Players grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="player in gameStore.players"
          :key="player.id"
          :class="[
            'player-area',
            {
              'ring-4 ring-yellow-400': gameStore.currentPlayer?.id === player.id,
              'ring-2 ring-green-400': player.finished,
              'opacity-60': player.finished
            }
          ]"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-2">
              <span class="text-white font-semibold">{{ player.name }}</span>
              <span v-if="player.id === gameStore.playerId" class="text-yellow-400 text-sm">(Vous)</span>
              <span v-if="player.finished" class="text-green-400 text-sm">✓ Terminé</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-white text-sm">{{ player.cardCount }} cartes</span>
              <div v-if="gameStore.currentPlayer?.id === player.id" class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          <!-- Target selection for current player -->
          <div v-if="gameStore.isMyTurn && gameStore.canDrawCard">
            <button
              v-for="target in gameStore.availableTargets"
              :key="target.id"
              v-if="target.id === player.id"
              @click="gameStore.drawCard(target.id)"
              class="w-full btn-primary text-sm py-2"
            >
              🎯 Piocher chez {{ target.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Game status -->
      <div class="text-center">
        <div v-if="gameStore.gameState === 'playing'" class="space-y-2">
          <div v-if="gameStore.isMyTurn" class="bg-yellow-500/20 border border-yellow-400 rounded-lg p-4">
            <p class="text-yellow-100 text-lg font-semibold">🎯 À votre tour !</p>
            <p class="text-yellow-200 text-sm">Choisissez un joueur adjacent pour piocher une carte</p>
          </div>
          <div v-else-if="gameStore.currentPlayer" class="bg-blue-500/20 border border-blue-400 rounded-lg p-4">
            <p class="text-blue-100">
              C'est au tour de <span class="font-semibold">{{ gameStore.currentPlayer.name }}</span>
            </p>
          </div>
        </div>
        
        <!-- Last action -->
        <div v-if="gameStore.lastAction" class="bg-white/10 backdrop-blur rounded-lg p-4 mt-4">
          <h3 class="text-white text-lg font-semibold mb-2">Dernière action</h3>
          <div v-if="gameStore.lastAction.type === 'draw'">
            <p class="text-green-200">
              {{ gameStore.lastAction.playerName }} a pioché une carte chez {{ gameStore.lastAction.targetPlayerName }}
            </p>
            <div v-if="gameStore.lastAction.pairsRemoved && gameStore.lastAction.pairsRemoved.length > 0" class="mt-2">
              <p class="text-blue-200 text-sm">
                {{ gameStore.lastAction.pairsRemoved.length }} paire(s) formée(s) et défaussée(s) !
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- My cards -->
      <div v-if="gameStore.myCards.length > 0" class="mt-6">
        <h3 class="text-white text-lg font-semibold mb-4 text-center">Vos cartes ({{ gameStore.myCards.length }})</h3>
        <div class="flex justify-center">
          <div class="flex flex-wrap justify-center gap-2 max-w-full">
            <PlayingCard
              v-for="(card, index) in gameStore.myCards"
              :key="card.id"
              :card="card"
              :style="{ 
                transform: `translateX(${(index - gameStore.myCards.length / 2) * 4}px)`,
                zIndex: 10 + index
              }"
              class="transition-all duration-200"
            />
          </div>
        </div>
      </div>

      <!-- Game finished -->
      <div v-if="gameStore.isGameFinished" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div class="bg-white/10 backdrop-blur-md rounded-xl p-6 m-4 max-w-md w-full border border-white/20">
          <h2 class="text-2xl font-bold text-white mb-4 text-center">🎉 Partie terminée !</h2>
          
          <!-- Winners -->
          <div v-if="gameStore.winners.length > 0" class="mb-4">
            <h3 class="text-lg font-semibold text-green-300 mb-2">🏆 Gagnants :</h3>
            <div class="space-y-1">
              <div
                v-for="winner in gameStore.winners"
                :key="winner.playerId"
                class="flex items-center justify-between bg-green-500/20 border border-green-400 rounded-lg p-2"
              >
                <span class="text-green-100">{{ winner.name }}</span>
                <span class="text-green-300 text-sm">Position {{ winner.position }}</span>
              </div>
            </div>
          </div>

          <!-- Loser -->
          <div v-if="gameStore.loser" class="mb-4">
            <h3 class="text-lg font-semibold text-red-300 mb-2">💀 Pouilleux :</h3>
            <div class="bg-red-500/20 border border-red-400 rounded-lg p-3">
              <div class="flex items-center justify-between">
                <span class="text-red-100 font-semibold">{{ gameStore.loser.name }}</span>
                <span class="text-red-300 text-sm">A gardé le Pouilleux !</span>
              </div>
              <div v-if="gameStore.loser.cards" class="mt-2 flex flex-wrap gap-1">
                <PlayingCard
                  v-for="card in gameStore.loser.cards"
                  :key="card.id"
                  :card="card"
                  class="transform scale-75"
                />
              </div>
            </div>
          </div>

          <div class="flex space-x-4">
            <button
              @click="restartGame"
              class="flex-1 btn-primary"
            >
              🔄 Rejouer
            </button>
            <button
              @click="goHome"
              class="flex-1 btn-secondary"
            >
              🏠 Accueil
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import PlayingCard from '../components/PlayingCard.vue'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()

const roomCode = route.params.roomCode

onMounted(() => {
  if (!gameStore.playerId) {
    router.push('/')
  }
})

onUnmounted(() => {
  // Don't disconnect when leaving the game view
})

function joinRoomManually() {
  router.push('/')
}

function restartGame() {
  gameStore.resetGame()
  router.push(`/lobby/${roomCode}`)
}

function goHome() {
  gameStore.disconnect()
  router.push('/')
}
</script>
