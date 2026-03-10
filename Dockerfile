# ── Stage 1: Install all deps (including dev) and type-check ──────────────────
FROM oven/bun:latest AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# ── Stage 2: Lean production image ────────────────────────────────────────────
FROM oven/bun:latest AS release
WORKDIR /app

# Copy only the files needed at runtime
COPY package.json bun.lock ./

# Install production dependencies only — excludes devDependencies
RUN bun install --frozen-lockfile --production

# Copy compiled source (Bun runs TypeScript directly, no build step needed)
COPY --from=base /app/src ./src

# The MCP server communicates over stdio
ENTRYPOINT ["bun", "run", "src/index.ts"]
