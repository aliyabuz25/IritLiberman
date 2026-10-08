FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

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