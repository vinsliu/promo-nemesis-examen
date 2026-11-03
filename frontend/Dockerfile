FROM node:22-alpine
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY --chown=node:node frontend/ ./
ENV HOST=0.0.0.0 PORT=3000 REACT_APP_API_BASE_URL=/api API_PROXY_TARGET=http://backend:5000
USER node
EXPOSE 3000
CMD ["npm", "start"]
