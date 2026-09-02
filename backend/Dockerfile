FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# getaddrinfo runs on the libuv threadpool, which defaults to 4. The scheduler
# resolves ads.txt hosts at SCAN_CONCURRENCY (8) while the sellers.json sync
# resolves its own targets, so DNS queues behind those 4 threads and unrelated
# work waits on it. The discovery Cloud Run Job already raises this for the same
# reason (see src/discovery/README.md).
ENV UV_THREADPOOL_SIZE=64

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
