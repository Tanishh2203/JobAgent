# syntax=docker/dockerfile:1.7
# --------------------------------------------------------------------
# Web app image (TanStack Start + Vite + Nitro node-server preset)
# Build:  docker build -t job-agent-web .
# Run:    docker run --rm -p 3000:3000 --env-file .env job-agent-web
# --------------------------------------------------------------------

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-slim AS build
WORKDIR /app
ENV NITRO_PRESET=node-server
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Use the AWS-flavored vite config so Nitro builds for Node, not Cloudflare.
RUN npx vite build --config vite.config.aws.ts

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Nitro node-server preset drops a self-contained server into .output/
COPY --from=build /app/.output ./.output
EXPOSE 3000
# Nitro entry
CMD ["node", ".output/server/index.mjs"]
