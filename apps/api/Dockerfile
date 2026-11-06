# Build context is the REPO ROOT (the API depends on packages/shared). See railway.toml.
FROM node:22-slim

# Prisma's query engine needs OpenSSL; pg needs CA certificates for managed Postgres.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.16.1

WORKDIR /app

# Install first (cached layer): only manifests, so code changes do not reinstall dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@queueless/api..."

COPY . .
RUN pnpm --filter @queueless/shared build \
 && pnpm --filter @queueless/api exec prisma generate \
 && pnpm --filter @queueless/api build

ENV NODE_ENV=production
EXPOSE 3000
# Nothing here needs root at runtime.
USER node

# 1) migrate.js: as queueless_owner apply any new migrations and set the app role password (idempotent).
# 2) main.js: the API, connecting as the non-owner queueless_app role (RLS applies).
CMD ["sh", "-c", "node apps/api/dist/scripts/migrate.js && node apps/api/dist/main.js"]
