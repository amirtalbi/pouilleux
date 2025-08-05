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
  const winner = ref(null)
  const myCards = ref([])
  const myPairs = ref([])
  const lastAction = ref(null)
  const gameLog = ref([])
  const error = ref('')

  // Computed
  const currentPlayer = computed(() => {
    return players.value[currentPlayerIndex.value] || null
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
      ? '/api' 
      : 'http://127.0.0.1:3000'

    socket.value = io(socketUrl, {
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

    socket.value.on('player-left', (data) => {
      console.log('Joueur parti:', data.playerName)
    })
  }

  const updateGameState = (state) => {
    gameState.value = state.gameState
    players.value = state.players || []
    currentPlayerIndex.value = state.currentPlayerIndex || 0
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

  const drawCard = (targetPlayerId) => {
    if (!socket.value || !socket.value.connected) {
      setError('Connexion non établie')
      return
    }

    if (!isMyTurn.value) {
      setError('Ce n\'est pas votre tour')
      return
    }

    socket.value.emit('draw-card', { targetPlayerId })
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
    winner.value = null
    myCards.value = []
    myPairs.value = []
    lastAction.value = null
    gameLog.value = []
    error.value = ''
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
    
    // Computed
    currentPlayer,
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
    disconnect
  }
})

  const canDrawCard = computed(() => {
    return isMyTurn.value && gameState.value === 'playing' && availableTargets.value.length > 0
  })

  const isGameFinished = computed(() => {
    return gameState.value === 'finished'
  })

  // Actions
  function initSocket() {
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? 'https://164.90.223.131'
      : 'http://localhost:3001'
    
    console.log('Connexion Socket.IO vers:', socketUrl)
    socket.value = io(socketUrl)
    
    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('Connecté au serveur Pouilleux')
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('Déconnecté du serveur Pouilleux')
    })

    socket.value.on('error', (data) => {
      error.value = data.message
      setTimeout(() => error.value = '', 5000)
    })

    socket.value.on('joined-room', (data) => {
      roomCode.value = data.roomCode
      playerId.value = data.playerId
    })

    socket.value.on('game-state', (state) => {
      gameState.value = state.gameState
      players.value = state.players
      currentPlayerIndex.value = state.currentPlayerIndex
      winners.value = state.winners
      loser.value = state.loser
      lastAction.value = state.lastAction
      availableTargets.value = state.availableTargets || []
      
      // Check if it's my turn
      const currentPlayer = players.value[currentPlayerIndex.value]
      isMyTurn.value = currentPlayer && currentPlayer.id === playerId.value
    })

    socket.value.on('your-cards', (cards) => {
      myCards.value = cards
    })

    socket.value.on('game-started', () => {
      console.log('Jeu du Pouilleux démarré !')
    })

    socket.value.on('card-drawn', (data) => {
      console.log(`${data.playerName} a pioché une carte`)
      if (data.lastAction) {
        lastAction.value = data.lastAction
      }
    })

    socket.value.on('game-ended', (data) => {
      console.log('Jeu terminé !', data)
      winners.value = data.winners
      loser.value = data.loser
    })

    socket.value.on('player-left', (data) => {
      console.log(`${data.playerName} a quitté la partie`)
    })
  }

  function joinRoom(code, name) {
    roomCode.value = code
    playerName.value = name
    socket.value.emit('join-room', { roomCode: code, playerName: name })
  }

  function toggleReady() {
    socket.value.emit('player-ready')
  }

  function startGame() {
    socket.value.emit('start-game')
  }

  function drawCard(targetPlayerId) {
    if (!canDrawCard.value) return
    
    console.log('Pioche une carte de:', targetPlayerId)
    socket.value.emit('draw-card', targetPlayerId)
  }

  function resetGame() {
    gameState.value = 'lobby'
    players.value = []
    currentPlayerIndex.value = 0
    winners.value = []
    loser.value = null
    myCards.value = []
    lastAction.value = null
    availableTargets.value = []
    error.value = ''
    isMyTurn.value = false
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
    }
    resetGame()
    roomCode.value = ''
    playerId.value = ''
    playerName.value = ''
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
    winners,
    loser,
    myCards,
    lastAction,
    availableTargets,
    error,
    isMyTurn,
    
    // Computed
    currentPlayer,
    myPlayer,
    canDrawCard,
    isGameFinished,
    
    // Actions
    initSocket,
    joinRoom,
    toggleReady,
    startGame,
    drawCard,
    resetGame,
    disconnect
  }
})
