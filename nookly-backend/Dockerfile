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
RUN npx prisma generate && npm run build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

# The server binds 0.0.0.0 and reads PORT from the environment (Render assigns
# this dynamically). File storage is Cloudflare R2 (S3-compatible) — no local
# disk volume is required.
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
