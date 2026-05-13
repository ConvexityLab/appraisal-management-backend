# Multi-stage build for Azure Container Apps
# Stage 1: Build
FROM node:22-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /usr/src/app

# Copy workspace config and package files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json ./

# Copy local workspace packages (e.g. @l1/shared-types) required for build
COPY packages/ ./packages/

# Install all dependencies including dev dependencies for build
RUN pnpm install --frozen-lockfile

# Copy source code and build scripts
COPY src/ ./src/
COPY scripts/copy-assets.cjs ./scripts/

# Build TypeScript
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine AS production

RUN npm install -g pnpm@9

# Install security updates + Chromium system deps for Playwright headless PDF rendering
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Tell Playwright to use the system Chromium instead of downloading its own binaries
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROMIUM_FLAGS="--disable-software-rasterizer --disable-dev-shm-usage"

# Create app directory
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Copy package files + workspace config and install production
# dependencies only.  Workspace yaml + packages/ MUST be copied before
# `pnpm install` so the @l1/shared-types workspace link resolves —
# without these, the runtime fails with `Cannot find module
# '@l1/shared-types'` because pnpm has no idea the workspace exists
# at Stage 2.  Stage 1 (builder) had them; Stage 2 was missing them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy Casbin authorization configuration files
COPY ./config ./config

# Change ownership to non-root user
RUN chown -R appuser:appuser /usr/src/app

# Switch to non-root user
USER appuser

# Expose port (Azure Container Apps expects this)
EXPOSE 8080

# Enhanced health check for Azure Container Apps
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health/live', (res) => { \
        if (res.statusCode === 200) process.exit(0); else process.exit(1); \
    }).on('error', () => process.exit(1))"

# Set environment variables for Azure
ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Use dumb-init to handle signals properly in containers
ENTRYPOINT ["dumb-init", "--"]

# Start the application.
#
# `dist/src/app-production.js` (not `dist/app-production.js`):
# tsconfig.json has `rootDir: "."` so tsc preserves source-tree structure
# under dist/.  After the @l1/shared-types workspace import was added,
# the emit root expanded to project root → `src/app-production.ts` now
# compiles to `dist/src/app-production.js`.  Crash-loop on the
# 0000841 revision was the symptom; this CMD path is the fix.
CMD ["node", "dist/src/app-production.js"]