FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# Development image: source is bind-mounted and run with tsx watch (see compose.dev.yml).
FROM deps AS dev

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

CMD ["npx", "tsx", "watch", "src/api/server.ts"]


FROM deps AS builder

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

CMD ["node", "dist/api/server.js"]
