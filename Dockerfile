# ── Stage 1: Build Vite frontend ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Lobby API + static files ────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY lobby/package*.json ./
RUN npm ci --omit=dev

COPY lobby/ .

# Inject built frontend into public/ so Express static middleware picks it up
COPY --from=builder /build/dist ./public

EXPOSE 4000

CMD ["node", "index.js"]
