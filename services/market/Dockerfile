# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY services/market/package.json ./services/market/
RUN npm install

FROM base AS build
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY services/market ./services/market
RUN npm run build --workspace=@trading/shared --workspace=@trading/db --workspace=@trading/service-market

FROM node:22-alpine AS dev
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY services/market ./services/market
EXPOSE 3000
CMD ["npx", "tsx", "watch", "services/market/src/index.ts"]

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/services/market/dist ./services/market/dist
COPY --from=build /app/services/market/package.json ./services/market/package.json
COPY package.json ./
RUN npm install --omit=dev --workspaces
USER node
EXPOSE 3000
CMD ["node", "services/market/dist/index.js"]
