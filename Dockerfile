# syntax=docker/dockerfile:1.7
# Keystone demo image (12-deployment §2). Multi-stage: deps → build (Next standalone + seeded template data)
# → runtime (distroless Node 22, non-root, no shell, HEALTHCHECK). /app/data is the volume (app DB, warehouses,
# snapshots). Size budget < 300 MB (11-build-plan Phase 11), checked by the CI docker job.
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

# Template for the data volume: the seeded app DB gzipped (about a quarter of its size), plus prebuilt
# warehouses when kept above. An empty, writable /app/data is created here because the runtime has no shell.
RUN mkdir -p template-data empty-data \
 && gzip -9 -c data/keystone.db > template-data/keystone.db.gz \
 && if [ -d data/warehouse ] && [ -n "$(ls -A data/warehouse)" ]; then cp -R data/warehouse template-data/; fi

# Distroless: Node, glibc, libstdc++ and OpenSSL/CA certificates only. The image's ENTRYPOINT is node itself.
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/keystone.db WAREHOUSE_DIR=/app/data/warehouse DEMO_SCALE=M KEYSTONE_WAREHOUSE_AUTOBUILD=1
# The standalone output already contains the traced packs/ directory.
COPY --from=build --chown=65532:65532 /app/.next/standalone ./
COPY --from=build --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=build --chown=65532:65532 /app/template-data ./template-data
COPY --from=build --chown=65532:65532 /app/empty-data ./data
COPY --chown=65532:65532 docker/entrypoint.mjs ./docker-entrypoint.mjs
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["/app/docker-entrypoint.mjs"]
