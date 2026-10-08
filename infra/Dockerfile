FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY prisma.config.ts ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY services ./services
COPY scripts ./scripts
# Generate uses only verified npm WASM artifacts; adapter avoids binary downloads.
RUN DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused npm run db:generate && npm run build
USER node
ENV BIND_HOST=0.0.0.0
CMD ["node","dist/services/api/src/main.js"]
