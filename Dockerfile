FROM node:18-bullseye-slim AS build
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production --omit=dev

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:18-bullseye-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    iputils-ping \
    util-linux \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

# Copy built application
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/cli ./cli
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/extra ./extra

# Create data directory
RUN mkdir -p /app/data && chown -R node:node /app/data

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 \
    CMD node extra/healthcheck.js

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "server/server.js"]