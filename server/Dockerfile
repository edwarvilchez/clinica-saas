# ==============================================================================
# Multi-Stage Production Dockerfile - Clinica SaaS API
# Base: node:20-alpine | Security: Non-Root User 'node' | HealthCheck: /health/ready
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. DEPENDENCY STAGE (Cached Layer)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS dependencies

WORKDIR /usr/src/app

# Install native dependencies if needed by build tools
RUN apk add --no-cache libc6-compat

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# ------------------------------------------------------------------------------
# 2. RUNTIME PRODUCTION STAGE (Hardened Minimal Image)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

LABEL maintainer="Equipo Clinica SaaS <devops@clinicasaas.com>"
LABEL description="Production Container Image for Clinica SaaS Backend API"
LABEL version="4.3.12"

WORKDIR /usr/src/app

# Install curl for healthcheck probing and dumb-init for PID 1 signal forwarding
RUN apk add --no-cache dumb-init curl

# Copy production node_modules from dependency stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package*.json ./

# Copy application code
COPY src ./src

# Create storage directories and set ownership to unprivileged user 'node'
RUN mkdir -p uploads storage backups && \
    chown -R node:node /usr/src/app

# Switch to unprivileged user (UID 1000)
USER node

# Hardened environment defaults
ENV NODE_ENV=production \
    PORT=5000 \
    LOG_LEVEL=info

EXPOSE 5000

# Docker Healthcheck targeting Phase 10 Readiness Probe (/health/ready)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health/ready || exit 1

# dumb-init handles SIGTERM and SIGINT gracefully, avoiding zombie processes
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "src/index.js"]
