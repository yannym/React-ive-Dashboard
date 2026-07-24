# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests (including lockfile)
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies required for build)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy application source
COPY . .

# Build application bundle
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency manifests and package-lock.json into runtime stage
COPY package.json package-lock.json* ./

# Install production dependencies using --omit=dev (replaces deprecated --only=production)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev || npm install --omit=dev; else npm install --omit=dev; fi

# Copy compiled build output and server entry point
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
