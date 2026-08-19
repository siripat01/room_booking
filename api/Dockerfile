# ========================================
# Stage 1: Builder - Install all dependencies
# ========================================
FROM oven/bun:1.3.14 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Set dummy DATABASE_URL for Prisma generate (doesn't connect to DB)
ENV DATABASE_URL="postgresql://user:password@localhost:5432/dummy"
RUN bun run prisma generate

# ========================================
# Stage 2: Production - Minimal runtime
# ========================================
FROM oven/bun:1.3.14 AS production

WORKDIR /app

ENV NODE_ENV=production
ENV BUN_ENV=production

# Copy package files
COPY --from=builder /app/package.json /app/bun.lock ./

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated

# Copy source code and config
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/libs ./libs
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3000

# Fly runs database migrations once via release_command before replacing app machines.
CMD ["bun", "run", "start"]
