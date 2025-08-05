#!/bin/bash

# 🐳 Script d'installation Docker pour Jeu du Président
# Compatible Ubuntu/Debian et CentOS/RHEL/Fedora

set -e  # Arrêter le script en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${PURPLE}🎮 $1${NC}"
}

# Fonction pour détecter l'OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [ -f /etc/redhat-release ]; then
        OS="CentOS"
        VER=$(rpm -q --qf "%{VERSION}" $(rpm -q --whatprovides redhat-release))
    else
        log_error "Impossible de détecter votre système d'exploitation"
        exit 1
    fi
}

# Fonction pour vérifier si on est root ou sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        if ! command -v sudo &> /dev/null; then
            log_error "Ce script nécessite les droits root ou sudo"
            exit 1
        fi
        SUDO="sudo"
    else
        SUDO=""
    fi
}

# Fonction pour mettre à jour le système
update_system() {
    log_info "Mise à jour du système..."
    
    case $OS in
        *"Ubuntu"*|*"Debian"*)
            $SUDO apt update && $SUDO apt upgrade -y
            $SUDO apt install -y curl wget gnupg lsb-release ca-certificates
            ;;
        *"CentOS"*|*"Red Hat"*|*"Fedora"*)
            if command -v dnf &> /dev/null; then
                $SUDO dnf update -y
                $SUDO dnf install -y curl wget gnupg ca-certificates
            else
                $SUDO yum update -y
                $SUDO yum install -y curl wget gnupg ca-certificates
            fi
            ;;
        *)
            log_warning "Système non reconnu, tentative avec apt..."
            $SUDO apt update && $SUDO apt upgrade -y
            $SUDO apt install -y curl wget gnupg lsb-release ca-certificates
            ;;
    esac
    
    log_success "Système mis à jour"
}

# Fonction pour installer Docker
install_docker() {
    log_info "Installation de Docker..."
    
    # Vérifier si Docker est déjà installé
    if command -v docker &> /dev/null; then
        log_warning "Docker est déjà installé"
        docker --version
        return 0
    fi
    
    case $OS in
        *"Ubuntu"*|*"Debian"*)
            # Ajouter la clé GPG officielle de Docker
            $SUDO mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            
            # Ajouter le repository Docker
            echo \
              "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
              $(lsb_release -cs) stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            # Installer Docker
            $SUDO apt update
            $SUDO apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
            
        *"CentOS"*|*"Red Hat"*)
            # Installer Docker via yum/dnf
            if command -v dnf &> /dev/null; then
                $SUDO dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            else
                $SUDO yum install -y yum-utils
                $SUDO yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                $SUDO yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            fi
            ;;
            
        *"Fedora"*)
            $SUDO dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            $SUDO dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
            
        *)
            log_error "Installation automatique de Docker non supportée pour votre OS"
            log_info "Veuillez installer Docker manuellement : https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac
    
    log_success "Docker installé avec succès"
}

# Fonction pour installer Docker Compose (si pas déjà inclus)
install_docker_compose() {
    log_info "Vérification de Docker Compose..."
    
    if docker compose version &> /dev/null; then
        log_success "Docker Compose est déjà disponible"
        return 0
    fi
    
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose (standalone) est disponible"
        return 0
    fi
    
    log_info "Installation de Docker Compose..."
    
    # Installer Docker Compose standalone
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    $SUDO curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    $SUDO chmod +x /usr/local/bin/docker-compose
    
    log_success "Docker Compose installé"
}

# Fonction pour configurer Docker
configure_docker() {
    log_info "Configuration de Docker..."
    
    # Démarrer et activer Docker
    $SUDO systemctl start docker
    $SUDO systemctl enable docker
    
    # Ajouter l'utilisateur actuel au groupe docker (si pas root)
    if [[ $EUID -ne 0 ]]; then
        $SUDO usermod -aG docker $USER
        log_warning "Vous devez vous déconnecter et vous reconnecter pour utiliser Docker sans sudo"
    fi
    
    log_success "Docker configuré"
}

# Fonction pour configurer le firewall
configure_firewall() {
    log_info "Configuration du firewall..."
    
    # Vérifier si ufw est installé (Ubuntu/Debian)
    if command -v ufw &> /dev/null; then
        $SUDO ufw allow 80/tcp
        $SUDO ufw allow 443/tcp
        $SUDO ufw allow 22/tcp  # SSH
        log_success "Firewall UFW configuré (ports 80, 443, 22)"
    # Vérifier si firewalld est installé (CentOS/RHEL/Fedora)
    elif command -v firewall-cmd &> /dev/null; then
        $SUDO firewall-cmd --permanent --add-port=80/tcp
        $SUDO firewall-cmd --permanent --add-port=443/tcp
        $SUDO firewall-cmd --permanent --add-port=22/tcp
        $SUDO firewall-cmd --reload
        log_success "Firewall firewalld configuré (ports 80, 443, 22)"
    else
        log_warning "Aucun firewall détecté. Assurez-vous que les ports 80 et 443 sont ouverts"
    fi
}

# Fonction pour créer les certificats SSL auto-signés
create_ssl_certificates() {
    log_info "Création des certificats SSL auto-signés..."
    
    # Créer le dossier pour les certificats
    mkdir -p ssl
    
    # Générer les certificats
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/nginx.key \
        -out ssl/nginx.crt \
        -subj "/C=FR/ST=France/L=Paris/O=President Game/CN=164.90.223.131" \
        2>/dev/null
    
    log_success "Certificats SSL créés dans le dossier ssl/"
}

# Fonction pour tester l'installation
test_installation() {
    log_info "Test de l'installation..."
    
    # Tester Docker
    if docker run --rm hello-world &> /dev/null; then
        log_success "Docker fonctionne correctement"
    else
        log_error "Problème avec Docker"
        return 1
    fi
    
    # Tester Docker Compose
    if docker compose version &> /dev/null || docker-compose --version &> /dev/null; then
        log_success "Docker Compose fonctionne correctement"
    else
        log_error "Problème avec Docker Compose"
        return 1
    fi
}

# Fonction principale
main() {
    log_header "Installation Docker pour Jeu du Président"
    echo
    
    # Vérifications préliminaires
    detect_os
    log_info "Système détecté : $OS $VER"
    
    check_permissions
    
    # Installation
    update_system
    echo
    
    install_docker
    echo
    
    install_docker_compose
    echo
    
    configure_docker
    echo
    
    configure_firewall
    echo
    
    create_ssl_certificates
    echo
    
    test_installation
    echo
    
    # Messages finaux
    log_success "Installation terminée avec succès !"
    echo
    log_header "Prochaines étapes :"
    echo -e "${BLUE}1.${NC} Clonez votre projet : ${YELLOW}git clone <votre-repo>${NC}"
    echo -e "${BLUE}2.${NC} Allez dans le dossier : ${YELLOW}cd president${NC}"
    echo -e "${BLUE}3.${NC} Démarrez le jeu : ${YELLOW}docker compose up -d${NC}"
    echo -e "${BLUE}4.${NC} Accédez au jeu : ${YELLOW}https://votre-serveur${NC}"
    echo
    
    if [[ $EUID -ne 0 ]]; then
        log_warning "N'oubliez pas de vous déconnecter et vous reconnecter pour utiliser Docker sans sudo"
    fi
    
    log_header "Votre serveur est prêt pour le Jeu du Président ! 🎮"
}

# Gestion des erreurs
trap 'log_error "Une erreur est survenue à la ligne $LINENO"' ERR

# Exécution du script principal
main "$@"
