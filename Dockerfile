# Multi-stage build for Azure Container Apps
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies including dev dependencies for build
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy any additional runtime files if needed
# COPY ./config ./config

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

# Start the application
CMD ["node", "dist/app-production.js"]