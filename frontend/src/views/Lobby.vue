<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">🃏 Salon Pouilleux</h1>
            <p class="text-gray-600">Code: <span class="font-mono font-bold">{{ gameStore.roomCode }}</span></p>
          </div>
          <button
            @click="leaveRoom"
            class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Quitter
          </button>
        </div>
      </div>

      <!-- Game Status -->
      <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">État de la partie</h2>
          <div class="flex items-center space-x-2">
            <div :class="gameStore.isConnected ? 'bg-green-500' : 'bg-red-500'" class="w-3 h-3 rounded-full"></div>
            <span class="text-sm text-gray-600">{{ gameStore.isConnected ? 'Connecté' : 'Déconnecté' }}</span>
          </div>
        </div>
        
        <div v-if="gameStore.gameState === 'lobby'" class="space-y-3">
          <p class="text-gray-700">En attente des joueurs...</p>
          <div class="flex items-center space-x-4">
            <span class="text-sm">{{ gameStore.players.length }} / {{ maxPlayers }} joueurs</span>
            <div class="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${(gameStore.players.length / maxPlayers) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Players List -->
      <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Joueurs ({{ gameStore.players.length }})</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div
            v-for="player in gameStore.players"
            :key="player.id"
            class="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
          >
            <div class="flex items-center space-x-3">
              <div 
                :class="[
                  'w-3 h-3 rounded-full',
                  player.isReady ? 'bg-green-500' : 'bg-gray-300'
                ]"
              ></div>
              <span class="font-medium">{{ player.name }}</span>
              <span v-if="player.isAdmin" class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Admin</span>
            </div>
            <div class="text-sm text-gray-500">
              {{ player.isReady ? '✅ Prêt' : '⏳ En attente' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Join Game Section -->
      <div v-if="!gameStore.isInRoom" class="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Rejoindre la partie</h2>
        <div class="flex space-x-3">
          <input
            v-model="playerName"
            type="text"
            placeholder="Votre nom"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxlength="20"
            @keyup.enter="joinGame"
          >
          <button
            @click="joinGame"
            :disabled="!canJoin"
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-md transition-colors"
          >
            Rejoindre
          </button>
        </div>
      </div>

      <!-- Game Controls -->
      <div v-if="gameStore.isInRoom" class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button
              @click="toggleReady"
              :class="[
                'font-medium py-2 px-6 rounded-md transition-colors',
                gameStore.myPlayer?.isReady 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
              ]"
            >
              {{ gameStore.myPlayer?.isReady ? '✅ Prêt' : '⏳ Se préparer' }}
            </button>

            <div v-if="gameStore.canStartGame" class="text-sm text-green-600 font-medium">
              🎮 Tous les joueurs sont prêts !
            </div>
          </div>

          <button
            v-if="gameStore.myPlayer?.isAdmin && gameStore.canStartGame"
            @click="startGame"
            class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
          >
            🚀 Démarrer la partie
          </button>
        </div>

        <!-- Game Rules Reminder -->
                <!-- Game Rules Reminder -->
        <div class="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 class="font-semibold text-blue-800 mb-2">🎯 Rappel des règles :</h3>
          <ul class="text-sm text-blue-700 space-y-1">
            <li>• Formez des paires avec les cartes de même valeur</li>
            <li>• À votre tour, piochez une carte chez le joueur suivant</li>
            <li>• Choisissez quelle carte vous voulez piocher</li>
            <li>• Éliminez toutes vos cartes pour gagner</li>
            <li>• Le dernier avec le Joker (Pouilleux) perd !</li>
          </ul>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const gameStore = useGameStore()

const playerName = ref('')
const maxPlayers = 6

const canJoin = computed(() => {
  return playerName.value.trim().length >= 2 && !gameStore.isInRoom
})

onMounted(() => {
  // Si on a déjà un nom, l'utiliser
  if (gameStore.playerName) {
    playerName.value = gameStore.playerName
    joinGame()
  }

  // Écouter les changements d'état du jeu
  if (gameStore.socket) {
    gameStore.socket.on('game-started', () => {
      router.push('/game')
    })
  }
})

const joinGame = () => {
  if (!canJoin.value) return
  
  gameStore.setPlayerName(playerName.value.trim())
  gameStore.joinRoom(gameStore.roomCode, playerName.value.trim())
}

const toggleReady = () => {
  gameStore.toggleReady()
}

const startGame = () => {
  gameStore.startGame()
}

const leaveRoom = () => {
  gameStore.disconnect()
  router.push('/')
}
</script>
