# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
COPY frontend/package.json ./
RUN npm install

FROM base AS build
COPY frontend ./
RUN npm run build

FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY frontend ./
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
