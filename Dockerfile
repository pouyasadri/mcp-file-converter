# Use the official Bun image
FROM oven/bun:1.1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Multi-stage build for a smaller production image
FROM oven/bun:1.1-slim AS release
WORKDIR /app
COPY --from=base /app /app

# The MCP server communicates over stdio, so we just run the index file
ENTRYPOINT ["bun", "run", "src/index.ts"]
