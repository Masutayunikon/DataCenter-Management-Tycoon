FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ .
COPY src/game/ /src/game/

EXPOSE 3001

CMD ["node", "index.js"]
