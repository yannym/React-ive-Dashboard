# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies required for build and runtime esbuild)
RUN npm ci || npm install

# Copy application source
COPY . .

# Build application bundle
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy all files and node_modules from builder to preserve full environment and dynamic component compilation capabilities
COPY --from=builder /app /app

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
