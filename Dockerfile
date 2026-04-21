# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/playwright:v1.57.0-jammy-arm64 AS base
WORKDIR /app
ENV NODE_ENV=production

# Install Noto CJK once at image build time — no per-request font download.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

# ── Deps ────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts ./

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "start"]
