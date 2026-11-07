# Candidato actualizado; verificar el resultado real con Trivy.
FROM node:24-trixie-slim
ENV NODE_ENV=production
WORKDIR /app
USER root
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force
COPY --chown=node:node server.js openapi.json ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
