<template>
  <div class="min-h-screen bg-gradient-to-br from-green-400 via-green-500 to-green-600 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-800 mb-2">🃏 Pouilleux</h1>
        <p class="text-gray-600">Jeu de cartes multijoueur</p>
      </div>

      <!-- Main Menu -->
      <div class="space-y-4">
        <!-- Create Room -->
        <div class="bg-blue-50 rounded-lg p-4">
          <h2 class="text-lg font-semibold text-blue-800 mb-3">Créer une salle</h2>
          <div class="space-y-3">
            <input
              v-model="adminPassword"
              type="password"
              placeholder="Mot de passe admin"
              class="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
            <button
              @click="createRoom"
              :disabled="isCreating"
              class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {{ isCreating ? 'Création...' : 'Créer une salle' }}
            </button>
          </div>
        </div>

        <!-- Join Room -->
        <div class="bg-green-50 rounded-lg p-4">
          <h2 class="text-lg font-semibold text-green-800 mb-3">Rejoindre une salle</h2>
          <div class="space-y-3">
            <input
              v-model="joinRoomCode"
              type="text"
              placeholder="Code de la salle"
              class="w-full px-3 py-2 border border-green-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 uppercase"
              maxlength="6"
            >
            <input
              v-model="joinPlayerName"
              type="text"
              placeholder="Votre nom"
              class="w-full px-3 py-2 border border-green-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              maxlength="20"
            >
            <button
              @click="joinRoom"
              :disabled="!canJoin"
              class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Rejoindre
            </button>
          </div>
        </div>

        <!-- Game Rules -->
        <div class="bg-yellow-50 rounded-lg p-4">
          <h2 class="text-lg font-semibold text-yellow-800 mb-3">🎯 Règles du jeu</h2>
          <div class="text-sm text-yellow-700 space-y-2">
            <p>• Formez des paires avec des cartes de même valeur</p>
            <p>• Piochez des cartes chez le joueur suivant (dans le sens du cercle)</p>
            <p>• Choisissez la carte que vous voulez piocher</p>
            <p>• Le but : se débarrasser de toutes ses cartes</p>
            <p>• Évitez d'être le dernier avec le Joker (Pouilleux)!</p>
            <p>• 2 à 6 joueurs</p>
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const gameStore = useGameStore()

const adminPassword = ref('')
const joinRoomCode = ref('')
const joinPlayerName = ref('')
const isCreating = ref(false)

const canJoin = computed(() => {
  return joinRoomCode.value.length === 6 && joinPlayerName.value.trim().length >= 2
})

const createRoom = async () => {
  if (!adminPassword.value) {
    gameStore.setError('Veuillez entrer le mot de passe admin')
    return
  }

  isCreating.value = true
  try {
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? '/api/create-room' 
      : 'http://127.0.0.1:3001/create-room'
      
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: adminPassword.value }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erreur de création')
    }

    const data = await response.json()
    gameStore.setRoomCode(data.roomCode)
    router.push('/lobby')
  } catch (error) {
    gameStore.setError(error.message)
  } finally {
    isCreating.value = false
  }
}

const joinRoom = async () => {
  if (!canJoin.value) return

  try {
    // Vérifier que la salle existe
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? `/api/room/${joinRoomCode.value.toUpperCase()}` 
      : `http://127.0.0.1:3001/room/${joinRoomCode.value.toUpperCase()}`
      
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Salle non trouvée')
    }

    // Si la salle existe, naviguer vers le lobby
    gameStore.setRoomCode(joinRoomCode.value.toUpperCase())
    gameStore.setPlayerName(joinPlayerName.value.trim())
    router.push('/lobby')
  } catch (error) {
    gameStore.setError(error.message)
  }
}
</script>
