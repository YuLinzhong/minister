#!/bin/sh
set -e

# Generate .claude/settings.json from env vars before starting the bot
bun run scripts/generate-claude-settings.ts

# Start the bot server
exec bun run packages/bot-server/src/index.ts
