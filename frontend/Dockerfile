FROM node:22-alpine
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY --chown=node:node frontend/ ./
# Proxy propre au conteneur : le lancement npm natif reste inchange.
RUN npm pkg set proxy=http://backend:5000 && chown -R node:node /app
ENV HOST=0.0.0.0 PORT=3000 BROWSER=none REACT_APP_API_BASE_URL=/api WDS_SOCKET_PORT=0
USER node
EXPOSE 3000
CMD ["npm", "start"]
