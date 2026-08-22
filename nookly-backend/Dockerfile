# Nookly backend — container image (generic; works on Render's Docker deploy
# option OR any OCI registry). Node 22 LTS (Express 5 / socket.io / Prisma 7).
FROM node:22-slim AS base

WORKDIR /app

# Prisma needs openssl at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# --- deps (full install: build step needs devDeps for prisma + tsc) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM deps AS build
COPY . .

# Render only injects env vars at CONTAINER RUNTIME, not during the Docker
# BUILD stage. prisma.config.ts resolves the datasource url via env("DATABASE_URL")
# on every CLI invocation (including `prisma generate`, which needs the config to
# load but never connects). Supply a throwaway placeholder so the build stage can
# resolve the config. This ENV lives ONLY in the build stage — it is NOT copied
# into the runtime stage (each FROM starts a fresh stage), so the running
# container uses the REAL DATABASE_URL that Render injects at runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npx prisma generate && npm run build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
# prisma.config.ts is required at RUNTIME: `npx prisma migrate deploy` loads it
# to resolve the datasource url via env("DATABASE_URL"). The build stage has it
# (COPY . .), but it must be copied here explicitly — without it, migrate deploy
# fails with "datasource.url property is required".
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# The server binds 0.0.0.0 and reads PORT from the environment (Render assigns
# this dynamically). File storage is Cloudflare R2 (S3-compatible) — no local
# disk volume is required.
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
