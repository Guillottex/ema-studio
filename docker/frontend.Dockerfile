# ---------- Build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /src
COPY scorm-engine/package*.json scorm-engine/
RUN cd scorm-engine && npm ci
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY scorm-engine scorm-engine
COPY frontend frontend
COPY scripts/fetch-brand.mjs scripts/fetch-brand.mjs
# Logo y favicon oficiales de www.emaservicios.com.ar (si no hay conexión se usa el logotipo alternativo)
RUN node scripts/fetch-brand.mjs || true
RUN cd frontend && npm run build

# ---------- Nginx ----------
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/frontend/dist /usr/share/nginx/html
EXPOSE 80
