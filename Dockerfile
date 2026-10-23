# Dominó PR: one image that builds the client and the server and serves both.
# Works on any Docker host (Render, Fly.io, Railway).

# ---- build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install with the lockfile first so dependency layers cache between builds
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

COPY . .

# Vite inlines these at build time. The host passes them as build args
# (Render exposes dashboard env vars to the build this way).
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_API_URL=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_API_URL=$VITE_API_URL

# client: tsc + vite build → client/dist · server: prisma generate + tsc → server/dist
RUN npm run build

# ---- runtime -------------------------------------------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev && npm cache clean --force

# The generated Prisma client is not a package: copy it from the build stage
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
# The server serves the SPA from ../../client/dist relative to server/dist
COPY --from=build /app/client/dist ./client/dist

# The host sets PORT (Render uses 10000); the server falls back to 3001
EXPOSE 3001
CMD ["npm", "start"]
