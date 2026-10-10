FROM node:22-alpine AS builder

WORKDIR /app

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# Remove build tools after install to keep image lean
RUN apk del python3 make g++

# Copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY server.js .
COPY db.js .

# Data directory (mounted as volume)
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]