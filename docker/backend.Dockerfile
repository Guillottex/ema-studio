# ---------- Build: motor SCORM + backend ----------
FROM node:20-bookworm-slim AS build
WORKDIR /src
COPY scorm-engine/package*.json scorm-engine/
RUN cd scorm-engine && npm ci
COPY backend/package*.json backend/
RUN cd backend && npm ci
COPY scorm-engine scorm-engine
COPY backend backend
RUN cd scorm-engine && npm run build \
 && cd ../backend && npm run build \
 && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data \
    ENGINE_DIST=/app/engine-dist \
    MIGRATIONS_DIR=/app/database/migrations \
    SEED_MEDIA_DIR=/app/database/seed-media \
    OPENAPI_FILE=/app/docs/openapi.yaml
WORKDIR /app/backend
COPY --from=build /src/backend/node_modules ./node_modules
COPY --from=build /src/backend/dist ./dist
COPY --from=build /src/backend/package.json ./package.json
COPY --from=build /src/scorm-engine/dist /app/engine-dist
COPY database /app/database
COPY docs/openapi.yaml /app/docs/openapi.yaml
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
