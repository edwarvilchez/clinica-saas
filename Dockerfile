# ==============================================================================
# Multi-Stage Production Dockerfile - Clinica SaaS Root Build Context
# ==============================================================================

FROM node:20-alpine AS dependencies

WORKDIR /usr/src/app
RUN apk add --no-cache libc6-compat

COPY server/package*.json ./
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

FROM node:20-alpine AS runner

WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init curl

COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY server/package*.json ./
COPY server/src ./src

RUN mkdir -p uploads storage backups && \
    chown -R node:node /usr/src/app

USER node

ENV NODE_ENV=production \
    PORT=5000 \
    LOG_LEVEL=info

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health/ready || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/index.js"]
