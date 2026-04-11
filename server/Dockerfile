FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# server.config.json must be provided at runtime (volume mount or copied in)
EXPOSE 3001

CMD ["node", "index.js"]
