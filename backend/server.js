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
      hasWon: false,
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

  resetGame() {
    // Réinitialiser l'état du jeu pour une nouvelle partie
    this.gameState = "lobby";
    this.deck = [];
    this.currentPlayerIndex = 0;
    this.gameStarted = false;
    this.winner = null;
    this.lastAction = null;
    
    // Réinitialiser chaque joueur
    this.players.forEach(player => {
      player.cards = [];
      player.pairs = [];
      player.isReady = false;
      player.hasLost = false;
      player.hasWon = false;
      player.turnFinished = false;
    });
    
    this.addToLog("🔄 Nouvelle partie ! Tous les joueurs doivent se déclarer prêts.");
    return this.getGameState();
  }

  createDeck() {
    this.deck = [];
    
    // Créer un jeu complet de 52 cartes standard
    for (let suit of SUITS) {
      for (let value of VALUES) {
        this.deck.push({ 
          suit, 
          value, 
          isPouilleux: false,
          id: `${suit}-${value}`
        });
      }
    }
    
    // Ajouter le Pouilleux (Joker) - 53e carte qui ne peut former aucune paire
    this.deck.push({ 
      suit: "joker", 
      value: "JOKER", 
      isPouilleux: true,
      id: "joker-pouilleux"
    });
    
    console.log(`Deck créé avec ${this.deck.length} cartes (52 normales + 1 Pouilleux)`);
    
    // Mélanger le deck de façon aléatoire
    for (let i = this.deck.length - 1; i > 0; i--) {
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
      // NE PAS trier les cartes pour éviter la triche - les cartes restent dans l'ordre de distribution
    });
  }

  formInitialPairs(player) {
    const pairs = [];
    const cardsByValue = {};

    // Grouper les cartes par valeur (sauf le Pouilleux)
    player.cards.forEach(card => {
      if (!card.isPouilleux) {
        if (!cardsByValue[card.value]) {
          cardsByValue[card.value] = [];
        }
        cardsByValue[card.value].push(card);
      }
    });

    // Former les paires
    Object.keys(cardsByValue).forEach(value => {
      const cards = cardsByValue[value];
      if (cards.length >= 2) {
        // Prendre les cartes par paires
        for (let i = 0; i < Math.floor(cards.length / 2) * 2; i += 2) {
          pairs.push([cards[i], cards[i + 1]]);
        }
      }
    });

    // Retirer les cartes qui forment des paires
    pairs.forEach(pair => {
      pair.forEach(card => {
        const index = player.cards.findIndex(c => 
          c.suit === card.suit && 
          c.value === card.value && 
          !c.isPouilleux
        );
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

  drawCard(playerId, cardIndex) {
    if (this.gameState !== "playing") {
      throw new Error("Le jeu n'est pas en cours");
    }

    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      throw new Error("Ce n'est pas votre tour");
    }

    // Trouver le joueur suivant dans le cercle qui a des cartes
    const targetPlayerIndex = this.getNextPlayerWithCards();
    if (targetPlayerIndex === null) {
      throw new Error("Aucun joueur n'a de cartes disponibles");
    }
    
    const targetPlayer = this.players[targetPlayerIndex];

    if (cardIndex < 0 || cardIndex >= targetPlayer.cards.length) {
      throw new Error("Index de carte invalide");
    }

    // Piocher la carte choisie
    const drawnCard = targetPlayer.cards.splice(cardIndex, 1)[0];
    currentPlayer.cards.push(drawnCard);

    this.lastAction = {
      type: "draw",
      player: currentPlayer.name,
      target: targetPlayer.name,
      cardIndex: cardIndex,
      cardDrawn: drawnCard
    };

    // Vérifier si le joueur peut former une paire avec la carte piochée 
    // (impossible avec le Pouilleux/Joker)
    const pairs = this.checkForPairs(currentPlayer, drawnCard);
    if (pairs.length > 0) {
      pairs.forEach(pair => {
        currentPlayer.pairs.push(pair);
        // Retirer les cartes qui forment la paire
        pair.forEach(card => {
          const index = currentPlayer.cards.findIndex(c => 
            c.suit === card.suit && 
            c.value === card.value && 
            !c.isPouilleux
          );
          if (index !== -1) {
            currentPlayer.cards.splice(index, 1);
          }
        });
      });

      this.lastAction.pairsFormed = pairs;
    }

    this.addToLog(`${currentPlayer.name} a pioché une carte chez ${targetPlayer.name}${pairs.length > 0 ? ' et a formé une paire !' : ''}`);

    // Marquer le joueur comme gagnant s'il n'a plus de cartes
    if (currentPlayer.cards.length === 0) {
      currentPlayer.hasWon = true;
      this.addToLog(`${currentPlayer.name} s'est débarrassé de toutes ses cartes !`);
    }

    // Vérifier la condition de fin de partie APRÈS chaque action
    const gameEndResult = this.checkGameEndCondition();
    if (gameEndResult.shouldEnd) {
      this.gameState = "finished";
      this.addToLog(gameEndResult.message);
      if (gameEndResult.loser) {
        gameEndResult.loser.hasLost = true;
      }
      if (gameEndResult.winner) {
        this.winner = gameEndResult.winner;
      }
      return this.getGameState();
    }

    // Passer au joueur suivant qui a encore des cartes
    this.nextPlayer();
    
    return this.getGameState();
  }

  checkGameEndCondition() {
    // Compter les joueurs avec des cartes
    const playersWithCards = this.players.filter(p => p.cards.length > 0);
    
    if (playersWithCards.length === 0) {
      // Cas impossible normalement
      return {
        shouldEnd: true,
        message: "Partie terminée : aucun joueur n'a de cartes !",
        loser: null,
        winner: this.players.find(p => p.hasWon) || this.players[0]
      };
    }
    
    if (playersWithCards.length === 1) {
      // Il ne reste qu'un joueur avec des cartes - c'est le perdant !
      const loser = playersWithCards[0];
      const winner = this.players.find(p => p.hasWon) || this.players.find(p => p.id !== loser.id);
      
      return {
        shouldEnd: true,
        message: `${loser.name} a perdu ! Il était le dernier avec des cartes (incluant le Pouilleux) !`,
        loser: loser,
        winner: winner
      };
    }

    // Vérifier si il ne reste que le Pouilleux en circulation
    const totalCards = playersWithCards.reduce((sum, player) => sum + player.cards.length, 0);
    const pouilleuCards = [];
    
    playersWithCards.forEach(player => {
      player.cards.forEach(card => {
        if (card.isPouilleux) {
          pouilleuCards.push({ player, card });
        }
      });
    });

    // Si il n'y a qu'une seule carte en jeu ET c'est le Pouilleux
    if (totalCards === 1 && pouilleuCards.length === 1) {
      const loser = pouilleuCards[0].player;
      const winner = this.players.find(p => p.hasWon) || this.players.find(p => p.id !== loser.id);
      
      return {
        shouldEnd: true,
        message: `${loser.name} a perdu ! Il lui reste seulement le Pouilleux !`,
        loser: loser,
        winner: winner
      };
    }

    // Vérifier si seules des cartes qui ne peuvent plus former de paires restent
    // (c'est-à-dire uniquement le Pouilleux et des cartes isolées)
    let canFormPairs = false;
    const cardValues = {};
    
    playersWithCards.forEach(player => {
      player.cards.forEach(card => {
        if (!card.isPouilleux) {
          cardValues[card.value] = (cardValues[card.value] || 0) + 1;
        }
      });
    });
    
    // Vérifier si des paires peuvent encore être formées
    for (const value in cardValues) {
      if (cardValues[value] >= 2) {
        canFormPairs = true;
        break;
      }
    }
    
    // Si aucune paire ne peut être formée et qu'il ne reste que le Pouilleux + cartes isolées
    if (!canFormPairs && pouilleuCards.length === 1) {
      const loser = pouilleuCards[0].player;
      const winner = this.players.find(p => p.hasWon) || this.players.find(p => p.id !== loser.id);
      
      return {
        shouldEnd: true,
        message: `${loser.name} a perdu ! Il ne reste que le Pouilleux et des cartes isolées !`,
        loser: loser,
        winner: winner
      };
    }

    return {
      shouldEnd: false,
      message: null,
      loser: null,
      winner: null
    };
  }

  checkForPairs(player, newCard) {
    const pairs = [];
    
    // RÈGLE FONDAMENTALE : Le Pouilleux (Joker) ne peut JAMAIS former de paire
    if (newCard.isPouilleux) {
      console.log(`${player.name} a pioché le Pouilleux - aucune paire possible !`);
      return pairs;
    }

    // Chercher une carte de même valeur pour former une paire
    const matchingCardIndex = player.cards.findIndex(card => 
      card.value === newCard.value && 
      !card.isPouilleux &&
      card.id !== newCard.id // Pas la même carte exacte
    );

    if (matchingCardIndex !== -1) {
      const matchingCard = player.cards[matchingCardIndex];
      pairs.push([newCard, matchingCard]);
      console.log(`Paire formée: ${newCard.value} de ${newCard.suit} avec ${matchingCard.value} de ${matchingCard.suit}`);
    }

    return pairs;
  }

  nextPlayer() {
    let attempts = 0;
    const maxAttempts = this.players.length;
    
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
      
      // Sécurité : éviter une boucle infinie
      if (attempts >= maxAttempts) {
        console.error("Erreur: impossible de trouver un joueur suivant avec des cartes");
        break;
      }
    } while (
      this.players[this.currentPlayerIndex].cards.length === 0 && 
      this.players.filter(p => p.cards.length > 0).length > 0
    );
    
    // Vérifier si le joueur actuel a des cartes
    if (this.players[this.currentPlayerIndex].cards.length === 0) {
      // Si aucun joueur actuel n'a de cartes, chercher le premier qui en a
      const playersWithCards = this.players.filter(p => p.cards.length > 0);
      if (playersWithCards.length > 0) {
        this.currentPlayerIndex = this.players.findIndex(p => p.id === playersWithCards[0].id);
      }
    }
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
        hasLost: p.hasLost || false,
        hasWon: p.hasWon || false,
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      nextPlayerIndex: this.gameState === "playing" ? 
        this.getNextPlayerWithCards() : null,
      lastAction: this.lastAction,
      winner: this.winner,
      gameLog: this.gameLog.slice(-10), // Derniers 10 messages
      canStart: this.canStartGame(),
    };
  }

  getNextPlayerWithCards() {
    if (this.gameState !== "playing") return null;
    
    // Dans le vrai Pouilleux, on pioche TOUJOURS chez le joueur suivant dans le cercle
    // même s'il n'a qu'une carte ou le Pouilleux
    const nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    
    // Trouver le prochain joueur qui a des cartes en suivant l'ordre du cercle
    let targetIndex = nextIndex;
    let attempts = 0;
    
    while (this.players[targetIndex].cards.length === 0 && attempts < this.players.length) {
      targetIndex = (targetIndex + 1) % this.players.length;
      attempts++;
    }
    
    return this.players[targetIndex].cards.length > 0 ? targetIndex : null;
  }

  getPlayerCards(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? {
      cards: player.cards,
      pairs: player.pairs
    } : null;
  }

  restartGame() {
    // Réinitialiser l'état de tous les joueurs
    this.players.forEach(player => {
      player.cards = [];
      player.pairs = [];
      player.isReady = false;
      player.hasWon = false;
      player.hasLost = false;
      player.turnFinished = false;
    });

    // Réinitialiser l'état du jeu
    this.gameState = "lobby";
    this.gameStarted = false;
    this.deck = [];
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.lastAction = null;
    this.gameLog = [];

    this.addToLog("Nouvelle partie ! Tous les joueurs doivent se préparer à nouveau.");
    return this.getGameState();
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

  socket.on("draw-card", ({ cardIndex }) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    try {
      const room = rooms.get(playerData.roomCode);
      if (!room) return;

      const gameState = room.drawCard(playerData.playerId, cardIndex);
      
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

  socket.on("get-target-cards", () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    try {
      const room = rooms.get(playerData.roomCode);
      if (!room) return;

      const currentPlayer = room.players[room.currentPlayerIndex];
      if (currentPlayer.id !== playerData.playerId) {
        socket.emit("error", { message: "Ce n'est pas votre tour" });
        return;
      }

      const targetPlayerIndex = room.getNextPlayerWithCards();
      if (targetPlayerIndex === null) {
        socket.emit("error", { message: "Aucun joueur cible disponible" });
        return;
      }

      const targetPlayer = room.players[targetPlayerIndex];
      
      // Envoyer le nombre de cartes du joueur cible (pour l'interface de sélection)
      socket.emit("target-cards", {
        targetPlayerId: targetPlayer.id,
        targetPlayerName: targetPlayer.name,
        cardCount: targetPlayer.cards.length
      });

    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("restart-game", () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    try {
      const room = rooms.get(playerData.roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === playerData.playerId);
      if (!player || !player.isAdmin) {
        socket.emit("error", { message: "Seul l'admin peut redémarrer la partie" });
        return;
      }

      const gameState = room.restartGame();
      io.to(playerData.roomCode).emit("game-restarted");
      io.to(playerData.roomCode).emit("game-state", gameState);

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Serveur Pouilleux en écoute sur le port ${PORT}`);
});
