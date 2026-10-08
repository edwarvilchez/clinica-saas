# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN (npm ci --no-audit || npm install --legacy-peer-deps --no-audit) && \
    npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build -- --configuration=production

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files (outputs to dist/browser as per angular.json)
COPY --from=builder /app/dist/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
