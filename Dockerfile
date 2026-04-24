FROM mcr.microsoft.com/playwright:v1.57.0-jammy AS base
WORKDIR /app

# Install Noto CJK once at image build time — no per-request font download.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

# ── Deps (all deps, including devDeps needed for the Next.js build) ──────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.js ./
RUN chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "start"]
