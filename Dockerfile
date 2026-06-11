# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build:inspect

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy LLM documentation files (llms.txt standard)
COPY --from=builder /app/llms.txt ./llms.txt
COPY --from=builder /app/llms-full.txt ./llms-full.txt

# Brand selection. The CMD below (`node dist/http-server.js`) resolves the
# active brand from process.env.BRAND and falls back to "infranodus" when unset
# — it does NOT go through the brand-specific bin/ launchers. To guarantee the
# correct brand even if the Fly runtime `[env] BRAND` is missing, each brand's
# fly.*.toml passes its BRAND via [build.args] and we bake it into the image
# here. An explicit runtime BRAND (Fly [env] or a secret) still overrides this.
ARG BRAND=infranodus
ENV BRAND=${BRAND}

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the HTTP server
CMD ["node", "dist/http-server.js"]
