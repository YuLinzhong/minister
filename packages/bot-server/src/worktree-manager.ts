// Manage per-user worktree directories — isolated CWD for each user's Claude session.
// Each worktree contains CLAUDE.md (user memory) and .claude/settings.json (per-user config).
import { resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { config } from "@minister/shared";

// Default CLAUDE.md content — embeds memory management rules so Claude discovers them natively
const DEFAULT_CLAUDE_MD = `# User Memory

<!-- Auto-maintained by Claude. Records user preferences, habits, and recurring instructions. -->

## Writing Rules

- When the user explicitly states a preference or recurring instruction (e.g. "remember I like..."), write it here
- Read existing content before writing to avoid duplicates
- Only record preferences and instructions — not conversation content or temporary info
- Keep this file concise, under 50 lines
`;

interface UserSettings {
  permissions: { deny: string[] };
}

// Derive parent data directory (contains both worktrees/ and users/)
const DATA_DIR = resolve(config.worktreeDir, "..");

// Permission deny rules built once from config — prevents cross-user data discovery via file tools
const USER_SETTINGS: UserSettings = {
  permissions: {
    deny: [
      `Read(${config.worktreeDir}/)`,
      `Read(${config.userDataDir}/)`,
      `Bash(ls ${DATA_DIR}*)`,
      `Bash(find ${DATA_DIR}*)`,
      "Bash(ls /root*)",
    ],
  },
};

// Track initialized users in memory to avoid per-request filesystem stat in the hot path
const initializedUsers = new Set<string>();

// Ensure the user's worktree directory is initialized and return its absolute path.
// Creates the directory structure on first call; subsequent calls use the in-memory cache.
export function ensureUserWorktree(userId: string): string {
  // Guard against path traversal — [\w\-:] excludes all path separators and dots
  if (!/^[\w\-:]{1,200}$/.test(userId)) {
    throw new Error(`Invalid userId format: ${userId}`);
  }

  const worktreePath = resolve(config.worktreeDir, userId);

  // Memory fast path: skip filesystem stat on subsequent calls within this process
  if (initializedUsers.has(userId)) return worktreePath;

  const settingsPath = resolve(worktreePath, ".claude/settings.json");

  if (!existsSync(settingsPath)) {
    // First visit — initialize directory structure
    mkdirSync(resolve(worktreePath, ".claude"), { recursive: true });

    // Migrate legacy CLAUDE.md if it exists, otherwise write default template
    const legacyPath = resolve(config.userDataDir, userId, "CLAUDE.md");
    const claudeMdPath = resolve(worktreePath, "CLAUDE.md");

    if (existsSync(legacyPath)) {
      const content = readFileSync(legacyPath, "utf-8");
      writeFileSync(claudeMdPath, content, { mode: 0o600 });
      // Rename so migration does not run again on the next restart
      renameSync(legacyPath, legacyPath + ".migrated");
      console.log(`[worktree] Migrated legacy CLAUDE.md for user ${userId}`);
    } else {
      writeFileSync(claudeMdPath, DEFAULT_CLAUDE_MD, { mode: 0o600 });
    }

    // Write per-user settings.json (permission deny-rules only, no credentials)
    writeFileSync(settingsPath, JSON.stringify(USER_SETTINGS, null, 2) + "\n", { mode: 0o600 });
    console.log(`[worktree] Initialized worktree for user ${userId} at ${worktreePath}`);
  }

  // Cache so future calls skip the stat
  initializedUsers.add(userId);
  return worktreePath;
}
