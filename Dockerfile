FROM node:18-alpine as build

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source et les fichiers de configuration
COPY . .

# Copier le fichier .env.production et le renommer en .env.local pour le build
COPY .env.production .env.local

# Build de l'application avec les variables d'environnement
RUN npm run build

# Stage de production avec Nginx
FROM nginx:alpine

# Copier la configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/nginx.conf

# Copier les fichiers buildés
COPY --from=build /app/dist /usr/share/nginx/html

# Copier les certificats SSL (auto-signés pour le développement)
RUN apk add --no-cache openssl
RUN mkdir -p /etc/nginx/ssl

# Générer des certificats auto-signés avec IP
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=FR/ST=France/L=Paris/O=President Game/CN=167.99.140.5"

# Exposer les ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
