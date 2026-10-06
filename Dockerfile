# syntax=docker/dockerfile:1.7
# Keystone demo image (12-deployment §2). Multi-stage: deps → build (Next standalone + seeded template data)
# → runtime (node:22-slim, non-root, HEALTHCHECK). /app/data is the volume (app DB, warehouses, snapshots).
#
#   docker build -t keystone .                              # small image; warehouses build on first use
#   docker build --build-arg PREBUILD=deep -t keystone .    # bake deep-pack warehouses (scale M) into the image

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG PREBUILD=none
ENV DATABASE_URL=file:/app/data/keystone.db WAREHOUSE_DIR=/app/data/warehouse DEMO_SCALE=M
RUN pnpm build
# Template data: migrate, build warehouses, seed every pack through the real lifecycle. The seeded app DB is
# always kept; warehouse files are kept only with PREBUILD=deep (otherwise rebuilt deterministically on first use).
RUN mkdir -p data && pnpm db:migrate && pnpm warehouse:build && pnpm db:seed \
 && if [ "$PREBUILD" = "none" ]; then rm -f data/warehouse/*.duckdb data/warehouse/*.meta.json; fi \
 && if [ "$PREBUILD" = "deep" ]; then for f in data/warehouse/*.meta.json; do id=$(basename "$f" .duckdb.meta.json); node -e "const y=require('yaml');const m=y.parse(require('fs').readFileSync('packs/'+process.argv[1]+'/pack.yaml','utf8'));process.exit(m.depth==='deep'?0:1)" "$id" || rm -f "data/warehouse/$id.duckdb" "$f"; done; fi

FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && groupadd --system keystone && useradd --system --gid keystone --home /app keystone
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/keystone.db WAREHOUSE_DIR=/app/data/warehouse DEMO_SCALE=M KEYSTONE_WAREHOUSE_AUTOBUILD=1
COPY --from=build --chown=keystone:keystone /app/.next/standalone ./
COPY --from=build --chown=keystone:keystone /app/.next/static ./.next/static
COPY --from=build --chown=keystone:keystone /app/packs ./packs
COPY --from=build --chown=keystone:keystone /app/data ./template-data
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/keystone-entrypoint
RUN mkdir -p /app/data && chown keystone:keystone /app/data
USER keystone
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["keystone-entrypoint"]
CMD ["node", "server.js"]
