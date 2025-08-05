# 🃏 Pouilleux - Jeu de cartes multijoueur

Un jeu de cartes **Pouilleux** (Old Maid) multijoueur en temps réel, développé avec Vue.js 3 et Node.js.

## 🎯 Règles du jeu

Le **Pouilleux** est un jeu de cartes traditionnel où l'objectif est d'éviter de se retrouver avec la dernière carte non appariée (le "Pouilleux", généralement la Dame de Pique).

### Déroulement
1. **Distribution** : Toutes les cartes sont distribuées équitablement entre les joueurs
2. **Paires initiales** : Chaque joueur forme automatiquement des paires avec les cartes de même valeur
3. **Tour de jeu** : À tour de rôle, chaque joueur pioche une carte chez un autre joueur
4. **Formation de paires** : Si la carte piochée forme une paire, elle est automatiquement retirée
5. **Victoire** : Le premier joueur à se débarrasser de toutes ses cartes gagne
6. **Défaite** : Le dernier joueur avec des cartes en main (qui a le Pouilleux) perd

### Participants
- **2 à 6 joueurs**
- **Durée** : 5-15 minutes par partie

## 🚀 Fonctionnalités

### ✨ Gameplay
- 🎴 **Jeu complet de 52 cartes** avec identification du Pouilleux (Dame de Pique)
- 🔄 **Formation automatique des paires** initiales et en cours de jeu
- 🎯 **Système de tours** avec indication du joueur actuel
- 📊 **Suivi en temps réel** des cartes et paires de chaque joueur
- 🏆 **Classement final** avec identification du perdant
- 📝 **Historique des actions** en temps réel

### 🌐 Multijoueur
- 🏠 **Salles privées** avec codes à 6 caractères
- 👥 **2 à 6 joueurs** par partie
- ⚡ **Temps réel** avec Socket.IO
- 🔄 **Reconnexion automatique** en cas de déconnexion
- 👤 **Gestion des administrateurs** de salle

### 💻 Interface
- 📱 **Design responsive** (mobile et desktop)
- 🎨 **Interface moderne** avec Tailwind CSS
- ✨ **Animations fluides** avec GSAP
- 🃏 **Cartes visuelles** avec symboles et couleurs
- 🌈 **Thème coloré** et attractif

### 🔧 Technique
- ⚡ **Architecture moderne** Vue.js 3 + Composition API
- 🏪 **Gestion d'état** avec Pinia
- 🔌 **Communication temps réel** avec Socket.IO
- 🐳 **Containerisation** Docker prête
- 🔒 **Authentification** pour la création de salles

## 🛠️ Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Installation manuelle

1. **Cloner le projet**
```bash
git clone <repo-url>
cd pouilleux
```

2. **Backend**
```bash
cd backend
npm install
cp .env.example .env
# Modifier ADMIN_PASSWORD dans .env
npm start
```

3. **Frontend**
```bash
cd frontend
npm install
npm run dev
```

### Installation avec Docker

```bash
# Construction et lancement
docker-compose up --build

# Ou utilisation du Dockerfile principal
docker build -t pouilleux .
docker run -p 80:80 pouilleux
```

## 🎮 Utilisation

### 1. Accès à l'application
- **Frontend** : http://localhost:5174
- **Backend** : http://localhost:3001

### 2. Créer une partie
1. Cliquez sur "Créer une salle"
2. Entrez le mot de passe admin (configuré dans `.env`)
3. Partagez le code de salle généré

### 3. Rejoindre une partie
1. Cliquez sur "Rejoindre une salle"
2. Entrez le code de salle et votre nom
3. Attendez que tous les joueurs soient prêts

### 4. Jouer
1. **Lobby** : Marquez-vous comme "Prêt"
2. **Démarrage** : L'admin démarre quand tous sont prêts
3. **Jeu** : Cliquez sur un autre joueur pour piocher une carte
4. **Fin** : Le dernier avec des cartes perd !

## 🧪 Tests

### Tests automatiques
```bash
cd pouilleux
chmod +x test-game.sh
./test-game.sh
```

### Tests manuels
1. **Multi-onglets** : Ouvrez plusieurs onglets pour simuler plusieurs joueurs
2. **Connexion/déconnexion** : Testez la robustesse de la connexion
3. **Responsive** : Testez sur mobile et desktop
4. **Partie complète** : Jouez une partie du début à la fin

## 📁 Structure du projet

```
pouilleux/
├── backend/                 # Serveur Node.js + Socket.IO
│   ├── server.js           # Serveur principal
│   ├── package.json        # Dépendances backend
│   └── .env               # Configuration
├── frontend/               # Application Vue.js 3
│   ├── src/
│   │   ├── components/     # Composants Vue (PlayingCard...)
│   │   ├── views/         # Pages (Home, Lobby, Game)
│   │   ├── stores/        # Stores Pinia (game.js)
│   │   ├── router/        # Router Vue
│   │   └── main.js        # Point d'entrée
│   ├── package.json       # Dépendances frontend
│   └── vite.config.js     # Configuration Vite
├── Dockerfile            # Image Docker production
├── docker-compose.yml    # Orchestration Docker
└── test-game.sh         # Script de tests
```

## ⚙️ Configuration

### Variables d'environnement (backend/.env)
```env
NODE_ENV=development
PORT=3001
ADMIN_PASSWORD=pouilleux-admin
```

### Configuration Vite (frontend/vite.config.js)
- **Port de développement** : 5174
- **Proxy API** : Redirection vers le backend
- **Build optimisé** : Chunks séparés pour les vendors

## 🔄 API Backend

### Endpoints REST
- `POST /create-room` - Créer une salle (nécessite mot de passe)
- `POST /join-room` - Valider l'accès à une salle  
- `GET /room/:code` - Informations sur une salle

### Events Socket.IO
- `join-room` - Rejoindre une salle
- `player-ready` - Marquer comme prêt
- `start-game` - Démarrer la partie (admin)
- `draw-card` - Piocher une carte
- `game-state` - État du jeu (broadcast)
- `your-cards` - Cartes du joueur
- `card-drawn` - Action de pioche

## 🎨 Technologies utilisées

### Frontend
- **Vue.js 3** - Framework progressif
- **Pinia** - Gestion d'état
- **Vue Router** - Routage
- **Tailwind CSS** - Framework CSS
- **GSAP** - Animations
- **Socket.IO Client** - Communication temps réel
- **Vite** - Build tool moderne

### Backend  
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Socket.IO** - WebSockets
- **UUID** - Génération d'identifiants
- **CORS** - Gestion des origines croisées

### DevOps
- **Docker** - Containerisation
- **Nginx** - Serveur web (production)
- **Docker Compose** - Orchestration

## 🚀 Déploiement en production

### Avec Docker
```bash
# Build de l'image
docker build -t pouilleux-prod .

# Déploiement
docker run -p 80:80 \
  -e NODE_ENV=production \
  -e ADMIN_PASSWORD=your-secure-password \
  pouilleux-prod
```

### Variables d'environnement de production
```env
NODE_ENV=production
PORT=3001
ADMIN_PASSWORD=your-secure-password
```

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/amazing-feature`)
3. Committez vos changes (`git commit -m 'Add amazing feature'`)
4. Push sur la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

## 📝 License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👥 Auteurs

- Développé avec amour pour le jeu de cartes traditionnel Pouilleux
- Contributions bienvenues !

---

**Amusez-vous bien et évitez le Pouilleux ! 🃏**
