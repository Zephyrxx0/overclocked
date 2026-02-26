# Build stage
FROM node:20-alpine as builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run the application
RUN npm install -g serve

# Copy built application from builder
COPY --from=builder /build/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# Start application
CMD ["serve", "-s", "dist", "-l", "3000"]
