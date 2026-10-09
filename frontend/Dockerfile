FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# Development image: Vite dev server with HMR (see compose.dev.yml).
FROM deps AS dev

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]


FROM deps AS builder

COPY . .

RUN npm run build


FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
