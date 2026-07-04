# syntax=docker/dockerfile:1

# ---- Build stage --------------------------------------------------------
# Node 24 to match .nvmrc. Debian slim + a toolchain so better-sqlite3 can
# compile its native addon if no prebuilt binary matches this platform.
FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# `next build` imports @/lib/db, which runs createDb() + migrations and leaves a
# fresh empty data/hackline.db behind. Drop it so it isn't baked into the image
# (the real DB lives on the ./data bind mount at runtime).
RUN rm -rf data

# Drop dev dependencies; keeps the already-compiled better-sqlite3 binary.
RUN npm prune --omit=dev

# ---- Runtime stage ------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Built app + production node_modules + drizzle/ migrations, from the build
# stage. (node_modules here is Linux-compiled, unlike the host's.)
COPY --from=build /app ./

# The SQLite DB lives in /app/data — mount a volume over it (see compose).
RUN mkdir -p data

EXPOSE 3000

# Bind to 0.0.0.0, NOT 127.0.0.1: inside a container loopback isn't reachable
# from the host even with a published port. Runs instrumentation (sync
# scheduler + Todoist provisioning) the same as `next start`.
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
