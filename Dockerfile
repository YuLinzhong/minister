# Stage 1: Install production dependencies only
FROM oven/bun:1-alpine AS deps

WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/bot-server/package.json packages/bot-server/
COPY packages/feishu-mcp/package.json packages/feishu-mcp/
RUN bun install --frozen-lockfile --production

# Stage 2: Final runtime image
FROM oven/bun:1-alpine

RUN apk add --no-cache curl bash libgcc libstdc++

# Install Claude CLI (native binary, no Node.js needed)
RUN curl -fsSL https://claude.ai/install.sh | bash \
    && ln -s /root/.claude/local/claude /usr/local/bin/claude

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/bot-server/node_modules ./packages/bot-server/node_modules
COPY --from=deps /app/packages/feishu-mcp/node_modules ./packages/feishu-mcp/node_modules

# Copy source code and config
COPY package.json ./
COPY packages/shared/ packages/shared/
COPY packages/bot-server/ packages/bot-server/
COPY packages/feishu-mcp/ packages/feishu-mcp/
COPY .claude/ .claude/
COPY config/ config/
COPY scripts/ scripts/

RUN chmod +x scripts/docker-entrypoint.sh

CMD ["sh", "scripts/docker-entrypoint.sh"]
