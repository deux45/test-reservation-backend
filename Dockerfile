# syntax=docker/dockerfile:1.9
# Production image: multi-stage, non-root, no install scripts, minimal surface.

FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini

# --- deps: dependency tree only, so it caches independently of source ---
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

# --- build: compile, then prune dev dependencies ---
FROM deps AS build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts

# --- runtime: what actually ships ---
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini as PID 1: reaps zombies and forwards SIGTERM so shutdown is graceful.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
