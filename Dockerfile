FROM node:22-bookworm-slim AS web-build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN npm ci

COPY apps/web apps/web
COPY packages packages
COPY dnd_items_150_ru_official_basic_rules_2014.json ./

RUN npm run build --workspace @shadow-edge/web


FROM golang:1.24.2-bookworm AS server-build

WORKDIR /app

ARG TARGETOS=linux
ARG TARGETARCH=amd64
ENV CGO_ENABLED=0
ENV GOOS=${TARGETOS}
ENV GOARCH=${TARGETARCH}

COPY go.work ./
COPY apps/server/go.mod apps/server/go.mod

RUN cd apps/server && go mod download

COPY apps/server apps/server

RUN go build -o /out/shadow-edge-server ./apps/server/cmd/server


FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PORT=8080
ENV SHADOW_EDGE_WEB_DIR=/app/apps/web/dist
ENV SHADOW_EDGE_DATA_FILE=/data/store.json
ENV SHADOW_EDGE_BESTIARY_CACHE_FILE=/data/dndsu-bestiary.json
ENV SHADOW_EDGE_UPLOAD_DIR=/data/uploads
ENV SHADOW_EDGE_DEEP_ZOOM_WORKER=/app/scripts/generate-deep-zoom.mjs

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci --omit=dev
COPY scripts/generate-deep-zoom.mjs /app/scripts/generate-deep-zoom.mjs

COPY --from=server-build /out/shadow-edge-server /app/shadow-edge-server
COPY --from=web-build /app/apps/web/dist /app/apps/web/dist
COPY data/store.json /app/seed-data/store.json
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
