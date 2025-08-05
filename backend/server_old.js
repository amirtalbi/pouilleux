const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://167.99.140.5", "http://167.99.140.5"]
      : "http://127.0.0.1:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://167.99.140.5", "http://167.99.140.5"]
      : "http://127.0.0.1:5173",
    credentials: true,
  })
);
app.use(express.json());

// Game state storage
const rooms = new Map();
const players = new Map();

// Card definitions pour le Pouilleux
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "K", "Q"];

// Classe pour le jeu du Pouilleux
class PouilleuGame {
  constructor(roomCode, adminIP) {
    this.roomCode = roomCode;
    this.adminIP = adminIP;
    this.players = [];
    this.gameState = "lobby"; // lobby, playing, finished
    this.deck = [];
    this.currentPlayerIndex = 0;
    this.gameStarted = false;
    this.winner = null;
    this.gameLog = [];
    this.lastAction = null;
    this.maxPlayers = 6;
    this.minPlayers = 2;
  }

  addPlayer(playerId, playerName, socketId) {
    if (this.gameState !== "lobby") {
      throw new Error("Impossible de rejoindre une partie en cours");
    }

    if (this.players.length >= this.maxPlayers) {
      throw new Error("Salle pleine");
    }

    if (this.players.find(p => p.name === playerName)) {
      throw new Error("Ce nom est déjà pris");
    }

    const player = {
      id: playerId,
      name: playerName,
      socketId: socketId,
      cards: [],
      isReady: false,
      pairs: [], // Paires formées
      isAdmin: this.players.length === 0,
      hasLost: false,
      turnFinished: false,
    };

    this.players.push(player);
    this.addToLog(`${playerName} a rejoint la partie`);
    return player;
  }

  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;

    const player = this.players[playerIndex];
    this.players.splice(playerIndex, 1);
    
    // Si c'était le joueur actuel, passer au suivant
    if (this.gameState === "playing" && playerIndex === this.currentPlayerIndex) {
      this.currentPlayerIndex = this.currentPlayerIndex % this.players.length;
    } else if (playerIndex < this.currentPlayerIndex) {
      this.currentPlayerIndex--;
    }

    this.addToLog(`${player.name} a quitté la partie`);
    
    // Vérifier si le jeu peut continuer
    if (this.gameState === "playing" && this.players.length < this.minPlayers) {
      this.gameState = "finished";
    }

    return player;
  }

  setPlayerReady(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error("Joueur non trouvé");
    
    player.isReady = !player.isReady;
    return player;
  }

  canStartGame() {
    return this.players.length >= this.minPlayers && 
           this.players.every(p => p.isReady) && 
           this.gameState === "lobby";
  }

  createDeck() {
    this.deck = [];
    
    // Créer un jeu complet sauf la Dame de Pique
    for (let suit of SUITS) {
      for (let value of VALUES) {
        if (!(suit === "spades" && value === "Q")) {
          this.deck.push({ suit, value });
        }
      }
    }
    
    // Ajouter le Pouilleux (Dame de Pique)
    this.deck.push({ suit: "spades", value: "Q", isPouilleux: true });
    
    // Mélanger le deck
    for (let i = this.deck.length - 1; i > 0; i--; ) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  distributeCards() {
    // Distribuer toutes les cartes équitablement
    let cardIndex = 0;
    while (cardIndex < this.deck.length) {
      for (let i = 0; i < this.players.length && cardIndex < this.deck.length; i++) {
        this.players[i].cards.push(this.deck[cardIndex]);
        cardIndex++;
      }
    }

    // Chaque joueur forme ses paires initiales
    this.players.forEach(player => {
      this.formInitialPairs(player);
    });
  }

  formInitialPairs(player) {
    const pairs = [];
    const cardsByValue = {};

    // Grouper les cartes par valeur
    player.cards.forEach(card => {
      if (!cardsByValue[card.value]) {
        cardsByValue[card.value] = [];
      }
      cardsByValue[card.value].push(card);
    });

    // Former les paires (sauf pour le Pouilleux)
    Object.keys(cardsByValue).forEach(value => {
      const cards = cardsByValue[value];
      if (cards.length >= 2 && !cards[0].isPouilleux) {
        // Prendre les cartes par paires
        for (let i = 0; i < Math.floor(cards.length / 2) * 2; i += 2) {
          pairs.push([cards[i], cards[i + 1]]);
        }
      }
    });

    // Retirer les cartes qui forment des paires
    pairs.forEach(pair => {
      pair.forEach(card => {
        const index = player.cards.findIndex(c => c.suit === card.suit && c.value === card.value);
        if (index !== -1) {
          player.cards.splice(index, 1);
        }
      });
    });

    player.pairs = pairs;
  }

  startGame() {
    if (!this.canStartGame()) {
      throw new Error("Impossible de démarrer la partie");
    }

    this.gameState = "playing";
    this.gameStarted = true;
    this.createDeck();
    this.distributeCards();
    this.currentPlayerIndex = 0;
    
    this.addToLog("La partie commence ! Formez des paires et évitez le Pouilleux !");
    return this.getGameState();
  }

  drawCard(playerId, targetPlayerId) {
    if (this.gameState !== "playing") {
      throw new Error("Le jeu n'est pas en cours");
    }

    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      throw new Error("Ce n'est pas votre tour");
    }

    const targetPlayer = this.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      throw new Error("Joueur cible non trouvé");
    }

    if (targetPlayer.cards.length === 0) {
      throw new Error("Ce joueur n'a plus de cartes");
    }

    if (targetPlayer.id === playerId) {
      throw new Error("Vous ne pouvez pas piocher dans vos propres cartes");
    }

    // Piocher une carte aléatoire
    const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
    const drawnCard = targetPlayer.cards.splice(randomIndex, 1)[0];
    currentPlayer.cards.push(drawnCard);

    this.lastAction = {
      type: "draw",
      player: currentPlayer.name,
      target: targetPlayer.name,
      cardDrawn: drawnCard
    };

    // Vérifier si le joueur peut former une paire avec la carte piochée
    const pairs = this.checkForPairs(currentPlayer, drawnCard);
    if (pairs.length > 0) {
      pairs.forEach(pair => {
        currentPlayer.pairs.push(pair);
        // Retirer les cartes qui forment la paire
        pair.forEach(card => {
          const index = currentPlayer.cards.findIndex(c => c.suit === card.suit && c.value === card.value);
          if (index !== -1) {
            currentPlayer.cards.splice(index, 1);
          }
        });
      });

      this.lastAction.pairsFormed = pairs;
    }

    this.addToLog(`${currentPlayer.name} a pioché une carte chez ${targetPlayer.name}${pairs.length > 0 ? ' et a formé une paire !' : ''}`);

    // Vérifier si le joueur a gagné (plus de cartes)
    if (currentPlayer.cards.length === 0) {
      currentPlayer.hasLost = false;
      this.addToLog(`${currentPlayer.name} a posé toutes ses cartes !`);
      
      // Vérifier si il ne reste qu'un joueur avec des cartes
      const playersWithCards = this.players.filter(p => p.cards.length > 0);
      if (playersWithCards.length === 1) {
        // Le dernier joueur avec des cartes perd (et a probablement le Pouilleux)
        playersWithCards[0].hasLost = true;
        this.winner = currentPlayer;
        this.gameState = "finished";
        this.addToLog(`${playersWithCards[0].name} a perdu ! Il avait le Pouilleux !`);
        return this.getGameState();
      }
    }

    // Passer au joueur suivant
    this.nextPlayer();
    
    return this.getGameState();
  }

  checkForPairs(player, newCard) {
    const pairs = [];
    
    // Ne pas former de paire avec le Pouilleux
    if (newCard.isPouilleux) {
      return pairs;
    }

    // Chercher une carte de même valeur
    const matchingCard = player.cards.find(card => 
      card.value === newCard.value && 
      !card.isPouilleux &&
      (card.suit !== newCard.suit || card.value !== newCard.value) // Pas la même carte
    );

    if (matchingCard) {
      pairs.push([newCard, matchingCard]);
    }

    return pairs;
  }

  nextPlayer() {
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.players[this.currentPlayerIndex].cards.length === 0 && 
             this.players.filter(p => p.cards.length > 0).length > 1);
  }

  addToLog(message) {
    this.gameLog.push({
      timestamp: new Date(),
      message: message
    });
    
    // Garder seulement les 50 derniers messages
    if (this.gameLog.length > 50) {
      this.gameLog = this.gameLog.slice(-50);
    }
  }

  getGameState() {
    return {
      roomCode: this.roomCode,
      gameState: this.gameState,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        cardCount: p.cards.length,
        pairCount: p.pairs.length,
        isReady: p.isReady,
        isAdmin: p.isAdmin,
        hasLost: p.hasLost,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      lastAction: this.lastAction,
      winner: this.winner,
      gameLog: this.gameLog.slice(-10), // Derniers 10 messages
      canStart: this.canStartGame(),
    };
  }

  getPlayerCards(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? {
      cards: player.cards,
      pairs: player.pairs
    } : null;
  }
}

// Routes API
app.post("/create-room", (req, res) => {
  const { password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }

  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const game = new PouilleuGame(roomCode, req.ip);
  rooms.set(roomCode, game);

  res.json({ roomCode });
});

app.post("/join-room", (req, res) => {
  const { roomCode, playerName } = req.body;

  if (!roomCode || !playerName) {
    return res.status(400).json({ error: "Code de salle et nom requis" });
  }

  const room = rooms.get(roomCode);
  if (!room) {
    return res.status(404).json({ error: "Salle non trouvée" });
  }

  res.json({ success: true });
});

app.get("/room/:roomCode", (req, res) => {
  const { roomCode } = req.params;
  const room = rooms.get(roomCode);
  
  if (!room) {
    return res.status(404).json({ error: "Salle non trouvée" });
  }

  res.json({ 
    roomCode,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    gameState: room.gameState
  });
});

// Socket.IO event handling
io.on("connection", (socket) => {
  console.log("Nouvelle connexion:", socket.id);

  socket.on("join-room", ({ roomCode, playerName }) => {
    try {
      const room = rooms.get(roomCode);
      if (!room) {
        socket.emit("error", { message: "Salle non trouvée" });
        return;
      }

      const playerId = uuidv4();
      const player = room.addPlayer(playerId, playerName, socket.id);
      
      players.set(socket.id, { playerId, roomCode });
      socket.join(roomCode);

      socket.emit("joined-room", { 
        roomCode, 
        playerId,
        playerName: player.name
      });

      // Envoyer l'état du jeu à tous les joueurs
      io.to(roomCode).emit("game-state", room.getGameState());

    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("player-ready", () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    try {
      const room = rooms.get(playerData.roomCode);
      if (!room) return;

      room.setPlayerReady(playerData.playerId);
      io.to(playerData.roomCode).emit("game-state", room.getGameState());

    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("start-game", () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    try {
      const room = rooms.get(playerData.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === playerData.playerId);
      if (!player || !player.isAdmin) {
        socket.emit("error", { message: "Seul l'admin peut démarrer la partie" });
        return;
      }

      const gameState = room.startGame();
      io.to(playerData.roomCode).emit("game-started");
      io.to(playerData.roomCode).emit("game-state", gameState);

      // Envoyer les cartes à chaque joueur
      room.players.forEach(p => {
        const playerSocket = [...io.sockets.sockets.values()]
          .find(s => s.id === p.socketId);
        if (playerSocket) {
          playerSocket.emit("your-cards", room.getPlayerCards(p.id));
        }
      });

    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("draw-card", ({ targetPlayerId }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    try {
      const room = rooms.get(playerData.roomCode);
      if (!room) return;

      const gameState = room.drawCard(playerData.playerId, targetPlayerId);
      
      io.to(playerData.roomCode).emit("game-state", gameState);
      
      // Mettre à jour les cartes de tous les joueurs
      room.players.forEach(p => {
        const playerSocket = [...io.sockets.sockets.values()]
          .find(s => s.id === p.socketId);
        if (playerSocket) {
          playerSocket.emit("your-cards", room.getPlayerCards(p.id));
        }
      });

      if (room.lastAction) {
        io.to(playerData.roomCode).emit("card-drawn", room.lastAction);
      }

    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Déconnexion:", socket.id);
    
    const playerData = players.get(socket.id);
    if (playerData) {
      const room = rooms.get(playerData.roomCode);
      if (room) {
        const removedPlayer = room.removePlayer(playerData.playerId);
        if (removedPlayer) {
          io.to(playerData.roomCode).emit("player-left", {
            playerName: removedPlayer.name
          });
          io.to(playerData.roomCode).emit("game-state", room.getGameState());
        }

        // Supprimer la salle si elle est vide
        if (room.players.length === 0) {
          rooms.delete(playerData.roomCode);
        }
      }
      
      players.delete(socket.id);
    }
  });
});

// Nettoyage automatique des salles vides
setInterval(() => {
  for (const [roomCode, room] of rooms.entries()) {
    if (room.players.length === 0) {
      rooms.delete(roomCode);
      console.log(`Salle ${roomCode} supprimée (vide)`);
    }
  }
}, 60000); // Toutes les minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur Pouilleux en écoute sur le port ${PORT}`);
});

// Game state storage
const rooms = new Map();
const players = new Map();

// Card definitions
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// Create deck for Pouilleux
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      // Skip Jack of Spades initially (it will be added separately as the "pouilleux")
      if (!(value === "J" && suit === "spades")) {
        deck.push({ 
          suit, 
          value, 
          id: `${value}-${suit}`,
          isPouilleux: false 
        });
      }
    }
  }
  
  // Add the Pouilleux (Jack of Spades)
  deck.push({ 
    suit: "spades", 
    value: "J", 
    id: "J-spades",
    isPouilleux: true 
  });
  
  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Game logic for Pouilleux
class PouilleuxGame {
  constructor(roomCode, creator) {
    this.roomCode = roomCode;
    this.creator = creator;
    this.players = [];
    this.gameState = "lobby"; // lobby, playing, finished
    this.currentPlayerIndex = 0;
    this.direction = 1; // 1 for clockwise, -1 for counter-clockwise
    this.winners = [];
    this.loser = null; // Player with the Pouilleux at the end
    this.lastAction = null;
    this.turnHistory = [];
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= 6) return false;
    if (this.gameState !== "lobby") return false;

    const player = {
      id: playerId,
      name: playerName,
      cards: [],
      ready: false,
      finished: false,
      position: null,
    };

    this.players.push(player);
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter((p) => p.id !== playerId);
    if (this.players.length === 0) {
      return true; // Room should be deleted
    }
    return false;
  }

  startGame() {
    if (this.players.length < 2) return false;
    if (this.gameState !== "lobby") return false;

    this.gameState = "playing";
    this.dealCards();
    this.removeInitialPairs();
    this.determineFirstPlayer();
    return true;
  }

  dealCards() {
    const deck = createDeck();
    const cardsPerPlayer = Math.floor(deck.length / this.players.length);
    let remainingCards = deck.length % this.players.length;

    this.players.forEach((player, index) => {
      const startIndex = index * cardsPerPlayer + Math.min(index, remainingCards);
      const extraCard = index < remainingCards ? 1 : 0;
      const endIndex = startIndex + cardsPerPlayer + extraCard;
      
      player.cards = deck.slice(startIndex, endIndex);
    });
  }

  removeInitialPairs() {
    this.players.forEach(player => {
      this.removePairsFromHand(player);
    });
  }

  removePairsFromHand(player) {
    const pairs = [];
    const cardsByValue = {};
    
    // Group cards by value
    player.cards.forEach(card => {
      if (!cardsByValue[card.value]) {
        cardsByValue[card.value] = [];
      }
      cardsByValue[card.value].push(card);
    });
    
    // Find pairs and remove them
    Object.keys(cardsByValue).forEach(value => {
      const cards = cardsByValue[value];
      if (cards.length >= 2) {
        // Remove pairs (2 cards at a time)
        const pairCount = Math.floor(cards.length / 2);
        for (let i = 0; i < pairCount; i++) {
          pairs.push([cards[i * 2], cards[i * 2 + 1]]);
        }
      }
    });
    
    // Remove paired cards from player's hand
    pairs.forEach(pair => {
      pair.forEach(card => {
        const index = player.cards.findIndex(c => c.id === card.id);
        if (index !== -1) {
          player.cards.splice(index, 1);
        }
      });
    });
    
    return pairs;
  }

  determineFirstPlayer() {
    // Player with the most cards starts
    let maxCards = Math.max(...this.players.map(p => p.cards.length));
    this.currentPlayerIndex = this.players.findIndex(p => p.cards.length === maxCards);
  }

  drawCard(playerId, targetPlayerId) {
    const player = this.players.find((p) => p.id === playerId);
    const targetPlayer = this.players.find((p) => p.id === targetPlayerId);
    
    if (!player || !targetPlayer) {
      return { success: false, error: "Joueur non trouvé" };
    }

    if (this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, error: "Ce n'est pas votre tour" };
    }

    if (targetPlayer.cards.length === 0) {
      return { success: false, error: "Ce joueur n'a plus de cartes" };
    }

    if (player.finished || targetPlayer.finished) {
      return { success: false, error: "Joueur déjà terminé" };
    }

    // Draw a random card from target player
    const randomIndex = Math.floor(Math.random() * targetPlayer.cards.length);
    const drawnCard = targetPlayer.cards.splice(randomIndex, 1)[0];
    player.cards.push(drawnCard);

    // Check for new pairs and remove them
    const removedPairs = this.removePairsFromHand(player);

    this.lastAction = {
      type: "draw",
      playerId: playerId,
      targetPlayerId: targetPlayerId,
      playerName: player.name,
      targetPlayerName: targetPlayer.name,
      cardDrawn: drawnCard,
      pairsRemoved: removedPairs
    };

    // Check if player finished (no cards left)
    if (player.cards.length === 0) {
      player.finished = true;
      this.winners.push({
        playerId: player.id,
        name: player.name,
        position: this.winners.length + 1
      });
    }

    // Check if target player finished
    if (targetPlayer.cards.length === 0 && !targetPlayer.finished) {
      targetPlayer.finished = true;
      this.winners.push({
        playerId: targetPlayer.id,
        name: targetPlayer.name,
        position: this.winners.length + 1
      });
    }

    // Check for game end
    const activePlayers = this.players.filter(p => !p.finished);
    if (activePlayers.length <= 1) {
      this.endGame();
      return { success: true, gameEnded: true };
    }

    this.nextPlayer();
    return { success: true };
  }

  getNextPlayer() {
    const activePlayers = this.players.filter(p => !p.finished);
    if (activePlayers.length <= 1) return null;

    // Find valid targets (players adjacent to current player with cards)
    const currentIndex = this.players.findIndex(p => p.id === this.players[this.currentPlayerIndex].id);
    const targets = [];

    // Check left neighbor
    let leftIndex = (currentIndex - 1 + this.players.length) % this.players.length;
    let leftPlayer = this.players[leftIndex];
    if (!leftPlayer.finished && leftPlayer.cards.length > 0) {
      targets.push(leftPlayer);
    }

    // Check right neighbor
    let rightIndex = (currentIndex + 1) % this.players.length;
    let rightPlayer = this.players[rightIndex];
    if (!rightPlayer.finished && rightPlayer.cards.length > 0) {
      targets.push(rightPlayer);
    }

    return targets;
  }

  nextPlayer() {
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
    } while (this.players[this.currentPlayerIndex].finished);
  }

  endGame() {
    // The remaining player with cards is the loser (has the Pouilleux)
    const remainingPlayer = this.players.find(p => !p.finished && p.cards.length > 0);
    if (remainingPlayer) {
      this.loser = {
        playerId: remainingPlayer.id,
        name: remainingPlayer.name,
        cards: remainingPlayer.cards
      };
    }

    this.gameState = "finished";
  }

  getGameState() {
    return {
      roomCode: this.roomCode,
      gameState: this.gameState,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        cardCount: p.cards.length,
        ready: p.ready,
        finished: p.finished,
        position: p.position,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      winners: this.winners,
      loser: this.loser,
      lastAction: this.lastAction,
      availableTargets: this.gameState === "playing" ? this.getNextPlayer() : []
    };
  }
}

// Routes
app.post("/create-room", (req, res) => {
  const { password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }

  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const game = new PouilleuxGame(roomCode, req.ip);
  rooms.set(roomCode, game);

  res.json({ roomCode });
});

app.post("/join-room", (req, res) => {
  const { roomCode, playerName } = req.body;

  if (!roomCode || !playerName) {
    return res.status(400).json({ error: "Code de salle et nom requis" });
  }

  const room = rooms.get(roomCode);
  if (!room) {
    return res.status(404).json({ error: "Salle non trouvée" });
  }

  res.json({ success: true });
});

app.get("/room/:roomCode", (req, res) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) {
    return res.status(404).json({ error: "Salle non trouvée" });
  }

  res.json(room.getGameState());
});

// Socket.IO events
io.on("connection", (socket) => {
  console.log("Nouveau client connecté:", socket.id);

  socket.on("join-room", ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error", { message: "Salle non trouvée" });
      return;
    }

    const success = room.addPlayer(socket.id, playerName);
    if (!success) {
      socket.emit("error", { message: "Impossible de rejoindre la salle" });
      return;
    }

    players.set(socket.id, { roomCode, playerName });
    socket.join(roomCode);

    io.to(roomCode).emit("game-state", room.getGameState());
    socket.emit("joined-room", { roomCode, playerId: socket.id });
  });

  socket.on("player-ready", () => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const room = rooms.get(playerInfo.roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (player) {
      player.ready = !player.ready;
      io.to(playerInfo.roomCode).emit("game-state", room.getGameState());
    }
  });

  socket.on("start-game", () => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const room = rooms.get(playerInfo.roomCode);
    if (!room) return;

    const success = room.startGame();
    if (success) {
      io.to(playerInfo.roomCode).emit("game-state", room.getGameState());
      io.to(playerInfo.roomCode).emit("game-started");

      // Send cards to each player
      room.players.forEach((player) => {
        io.to(player.id).emit("your-cards", player.cards);
      });
    }
  });

  socket.on("draw-card", (targetPlayerId) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const room = rooms.get(playerInfo.roomCode);
    if (!room) return;

    const result = room.drawCard(socket.id, targetPlayerId);

    if (result.success) {
      io.to(playerInfo.roomCode).emit("game-state", room.getGameState());
      
      // Send updated cards to players
      room.players.forEach((player) => {
        io.to(player.id).emit("your-cards", player.cards);
      });

      io.to(playerInfo.roomCode).emit("card-drawn", {
        playerId: socket.id,
        targetPlayerId: targetPlayerId,
        playerName: playerInfo.playerName,
        lastAction: room.lastAction
      });

      if (result.gameEnded) {
        io.to(playerInfo.roomCode).emit("game-ended", {
          winners: room.winners,
          loser: room.loser
        });
      }
    } else {
      socket.emit("error", { message: result.error });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté:", socket.id);

    const playerInfo = players.get(socket.id);
    if (playerInfo) {
      const room = rooms.get(playerInfo.roomCode);
      if (room) {
        const shouldDeleteRoom = room.removePlayer(socket.id);

        if (shouldDeleteRoom) {
          rooms.delete(playerInfo.roomCode);
        } else {
          io.to(playerInfo.roomCode).emit("game-state", room.getGameState());
          io.to(playerInfo.roomCode).emit("player-left", {
            playerId: socket.id,
            playerName: playerInfo.playerName,
          });
        }
      }
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Serveur Pouilleux démarré sur le port ${PORT}`);
});
