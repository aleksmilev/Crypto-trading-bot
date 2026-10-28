# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN npm install

FROM base AS build
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
RUN npm run build --workspace=@trading/shared --workspace=@trading/db

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/src/migrations ./packages/db/dist/migrations
COPY package.json ./
RUN npm install --omit=dev --workspaces
CMD ["node", "packages/db/dist/migrate.js"]
