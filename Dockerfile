# Multi-stage build pour le frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Multi-stage build pour le backend
FROM node:18-alpine AS backend-build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

# Image finale avec nginx et node
FROM nginx:alpine

# Installer Node.js pour le backend
RUN apk add --no-cache nodejs npm

# Copier les fichiers du frontend buildés
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copier le backend
COPY --from=backend-build /app/backend /app/backend

# Configuration nginx
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;

    # Frontend
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # API Backend
    location /api/ {
        rewrite ^/api/(.*) /\$1 break;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket pour Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Script de démarrage
COPY <<EOF /start.sh
#!/bin/sh
# Démarrer le backend en arrière-plan
cd /app/backend && node server.js &

# Démarrer nginx
nginx -g 'daemon off;'
EOF

RUN chmod +x /start.sh

EXPOSE 80

ENV NODE_ENV=production
ENV PORT=3001

CMD ["/start.sh"]
