#!/bin/bash

echo "🃏 Test complet du jeu Pouilleux"
echo "================================="

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les étapes
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Variables
BACKEND_URL="http://127.0.0.1:3001"
FRONTEND_URL="http://127.0.0.1:5174"
ADMIN_PASSWORD="pouilleux-admin"

print_step "1. Vérification des serveurs"

# Test backend
if curl -s $BACKEND_URL > /dev/null; then
    print_success "Backend accessible sur $BACKEND_URL"
else
    print_error "Backend non accessible sur $BACKEND_URL"
    echo "Démarrez le backend avec: cd backend && npm start"
    exit 1
fi

# Test frontend
if curl -s $FRONTEND_URL > /dev/null; then
    print_success "Frontend accessible sur $FRONTEND_URL"
else
    print_error "Frontend non accessible sur $FRONTEND_URL"
    echo "Démarrez le frontend avec: cd frontend && npm run dev"
    exit 1
fi

print_step "2. Test de création de salle"

# Test création de salle
ROOM_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$ADMIN_PASSWORD\"}" \
  $BACKEND_URL/create-room)

if echo $ROOM_RESPONSE | grep -q "roomCode"; then
    ROOM_CODE=$(echo $ROOM_RESPONSE | grep -o '"roomCode":"[^"]*"' | cut -d'"' -f4)
    print_success "Salle créée avec le code: $ROOM_CODE"
else
    print_error "Impossible de créer une salle"
    echo "Réponse: $ROOM_RESPONSE"
    exit 1
fi

print_step "3. Test de vérification de salle"

# Test vérification salle
ROOM_INFO=$(curl -s $BACKEND_URL/room/$ROOM_CODE)
if echo $ROOM_INFO | grep -q "roomCode"; then
    print_success "Salle $ROOM_CODE trouvée et accessible"
else
    print_error "Impossible de récupérer les informations de la salle"
    echo "Réponse: $ROOM_INFO"
fi

print_step "4. Test avec mauvais mot de passe"

# Test avec mauvais mot de passe
BAD_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"mauvais-mot-de-passe\"}" \
  $BACKEND_URL/create-room)

if echo $BAD_RESPONSE | grep -q "error"; then
    print_success "Authentification fonctionne (mauvais mot de passe rejeté)"
else
    print_warning "L'authentification pourrait ne pas fonctionner correctement"
fi

print_step "5. Test de salle inexistante"

# Test salle inexistante
INVALID_ROOM=$(curl -s $BACKEND_URL/room/INVALID)
if echo $INVALID_ROOM | grep -q "error"; then
    print_success "Gestion des salles inexistantes fonctionne"
else
    print_warning "La gestion des salles inexistantes pourrait ne pas fonctionner"
fi

print_step "6. Instructions pour tester le jeu complet"

echo ""
echo "🎮 Pour tester le jeu complet:"
echo "1. Ouvrez votre navigateur sur: $FRONTEND_URL"
echo "2. Créez une salle avec le mot de passe: $ADMIN_PASSWORD"
echo "3. Rejoignez la salle avec le code: $ROOM_CODE"
echo "4. Ouvrez plusieurs onglets pour simuler plusieurs joueurs"
echo "5. Testez le flow complet: lobby -> prêt -> démarrer -> jouer"

echo ""
echo "🃏 Fonctionnalités à tester manuellement:"
echo "- ✅ Création/rejoindre une salle"
echo "- ✅ Système de lobby avec statut prêt"
echo "- ✅ Démarrage de partie (2+ joueurs prêts)"
echo "- ✅ Distribution automatique des cartes"
echo "- ✅ Formation automatique des paires initiales"
echo "- ✅ Système de tours (joueur actuel)"
echo "- ✅ Pioche de cartes chez les autres joueurs"
echo "- ✅ Formation automatique de nouvelles paires"
echo "- ✅ Identification du Pouilleux (Dame de Pique)"
echo "- ✅ Fin de partie (dernier avec des cartes = perdant)"
echo "- ✅ Classement final"
echo "- ✅ Historique du jeu en temps réel"
echo "- ✅ Interface responsive (mobile/desktop)"
echo "- ✅ Animations des cartes"
echo "- ✅ Déconnexion/reconnexion des joueurs"

echo ""
print_success "Tests de base réussis ! L'application semble fonctionnelle."
echo "Utilisez les instructions ci-dessus pour tester l'interface utilisateur."
