// Load environment variables from .env and config/claude.env at project root
import { resolve, dirname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// Load claude.env first (lower priority), then .env (higher priority, already set keys win)
loadEnvFile(resolve(PROJECT_ROOT, "config/claude.env"));
loadEnvFile(resolve(PROJECT_ROOT, ".env"));

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

function loadPromptFile(filename: string): string {
  return readFileSync(resolve(PROJECT_ROOT, "config", filename), "utf-8").trim();
}

export const config = {
  feishu: {
    appId: required("FEISHU_APP_ID"),
    appSecret: required("FEISHU_APP_SECRET"),
  },
  claude: {
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
    systemPrompt: process.env.CLAUDE_SYSTEM_PROMPT || loadPromptFile("system-prompt.md"),
    userMemoryPrompt: loadPromptFile("user-memory-prompt.md"),
  },
  userDataDir: resolve(PROJECT_ROOT, "data/users"),
} as const;
