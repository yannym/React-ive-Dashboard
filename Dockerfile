# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for build)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy application source code
COPY . .

# Build Vite static assets and bundled server (dist/server.cjs)
RUN npm run build

# Remove devDependencies to leave only production node_modules
RUN npm prune --omit=dev

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy production node_modules, compiled dist output, and package.json from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
