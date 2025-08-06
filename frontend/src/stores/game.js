import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io } from 'socket.io-client'

export const useGameStore = defineStore('pouilleux', () => {
  // State
  const socket = ref(null)
  const isConnected = ref(false)
  const roomCode = ref('')
  const playerId = ref('')
  const playerName = ref('')
  const gameState = ref('lobby') // lobby, playing, finished
  const players = ref([])
  const currentPlayerIndex = ref(0)
  const nextPlayerIndex = ref(null)
  const winner = ref(null)
  const myCards = ref([])
  const myPairs = ref([])
  const lastAction = ref(null)
  const gameLog = ref([])
  const error = ref('')
  const targetCards = ref(null) // Pour les cartes du joueur cible

  // Computed
  const currentPlayer = computed(() => {
    return players.value[currentPlayerIndex.value] || null
  })

  const nextPlayer = computed(() => {
    return nextPlayerIndex.value !== null ? players.value[nextPlayerIndex.value] : null
  })

  const myPlayer = computed(() => {
    return players.value.find(p => p.id === playerId.value) || null
  })

  const isMyTurn = computed(() => {
    return currentPlayer.value?.id === playerId.value
  })

  const isInRoom = computed(() => {
    return myPlayer.value !== null
  })

  const canStartGame = computed(() => {
    return players.value.length >= 2 && 
           players.value.every(p => p.isReady) && 
           gameState.value === 'lobby'
  })

  // Actions
  const initSocket = () => {
    if (socket.value) return

    // Utiliser une URL relative en développement et production
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? '/' 
      : 'http://127.0.0.1:3001'

    socket.value = io(socketUrl, {
      path: process.env.NODE_ENV === 'production' ? '/socket.io/' : '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    })

    socket.value.on('connect', () => {
      console.log('Connecté au serveur')
      isConnected.value = true
      clearError()
    })

    socket.value.on('disconnect', () => {
      console.log('Déconnecté du serveur')
      isConnected.value = false
    })

    socket.value.on('error', (data) => {
      console.error('Erreur socket:', data)
      setError(data.message || 'Erreur de connexion')
    })

    socket.value.on('joined-room', (data) => {
      console.log('Rejoint la salle:', data)
      playerId.value = data.playerId
      playerName.value = data.playerName
    })

    socket.value.on('game-state', (state) => {
      console.log('État du jeu mis à jour:', state)
      updateGameState(state)
    })

    socket.value.on('your-cards', (data) => {
      console.log('Mes cartes:', data)
      myCards.value = data.cards || []
      myPairs.value = data.pairs || []
    })

    socket.value.on('card-drawn', (action) => {
      console.log('Carte tirée:', action)
      lastAction.value = action
    })

    socket.value.on('game-started', () => {
      console.log('Partie démarrée!')
      gameState.value = 'playing'
    })

    socket.value.on('target-cards', (data) => {
      console.log('Cartes du joueur cible:', data)
      targetCards.value = data
    })

    socket.value.on('player-left', (data) => {
      console.log('Joueur parti:', data.playerName)
    })

    socket.value.on('game-reset', () => {
      console.log('Partie relancée!')
      // Réinitialiser les cartes locales
      myCards.value = []
      myPairs.value = []
      lastAction.value = null
    })
  }

  const updateGameState = (state) => {
    gameState.value = state.gameState
    players.value = state.players || []
    currentPlayerIndex.value = state.currentPlayerIndex || 0
    nextPlayerIndex.value = state.nextPlayerIndex
    winner.value = state.winner
    gameLog.value = state.gameLog || []
    if (state.lastAction) {
      lastAction.value = state.lastAction
    }
  }

  const setRoomCode = (code) => {
    roomCode.value = code
  }

  const setPlayerName = (name) => {
    playerName.value = name
  }

  const setError = (message) => {
    error.value = message
    setTimeout(() => {
      error.value = ''
    }, 5000)
  }

  const clearError = () => {
    error.value = ''
  }

  const joinRoom = (code, name) => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    socket.value.emit('join-room', {
      roomCode: code,
      playerName: name
    })
  }

  const toggleReady = () => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    socket.value.emit('player-ready')
  }

  const startGame = () => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    socket.value.emit('start-game')
  }

  const drawCard = (cardIndex) => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    if (!isMyTurn.value) {
      setError('Ce n\'est pas votre tour')
      return
    }

    socket.value.emit('draw-card', { cardIndex })
  }

  const getTargetCards = () => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    socket.value.emit('get-target-cards')
  }

  const restartGame = () => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    socket.value.emit('restart-game')
  }

  const reorderCards = (newOrder) => {
    // Réorganiser les cartes localement
    myCards.value = newOrder
  }

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    
    // Reset state
    isConnected.value = false
    roomCode.value = ''
    playerId.value = ''
    playerName.value = ''
    gameState.value = 'lobby'
    players.value = []
    currentPlayerIndex.value = 0
    nextPlayerIndex.value = null
    winner.value = null
    myCards.value = []
    myPairs.value = []
    lastAction.value = null
    gameLog.value = []
    error.value = ''
    targetCards.value = null
  }

  return {
    // State
    socket,
    isConnected,
    roomCode,
    playerId,
    playerName,
    gameState,
    players,
    currentPlayerIndex,
    winner,
    myCards,
    myPairs,
    lastAction,
    gameLog,
    error,
    targetCards,
    
    // Computed
    currentPlayer,
    nextPlayer,
    myPlayer,
    isMyTurn,
    isInRoom,
    canStartGame,
    
    // Actions
    initSocket,
    setRoomCode,
    setPlayerName,
    setError,
    clearError,
    joinRoom,
    toggleReady,
    startGame,
    drawCard,
    getTargetCards,
    restartGame,
    reorderCards,
    disconnect
  }
})
