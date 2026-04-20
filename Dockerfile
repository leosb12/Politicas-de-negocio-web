FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine AS runtime

ENV FRONTEND_API_UPSTREAM=backend:8080
ENV API_BASE_URL=

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist/politicas-negocio-web/browser /usr/share/nginx/html
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/runtime-config.js.template /usr/share/nginx/html/runtime-config.js.template
COPY docker/nginx/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80
