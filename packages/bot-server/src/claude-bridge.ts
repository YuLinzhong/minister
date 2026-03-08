// Bridge to Claude Code CLI — spawn process and parse NDJSON stream
import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Session } from "@minister/shared";
import { config } from "@minister/shared";
import { ensureUserWorktree } from "./worktree-manager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");

// MCP config is static for the lifetime of the process — write once, reuse forever.
// Kept as a temp file (not in the worktree) so Claude cannot read raw credentials.
const MCP_CONFIG_PATH = resolve(tmpdir(), `minister-mcp-${process.pid}.json`);
writeFileSync(
  MCP_CONFIG_PATH,
  JSON.stringify({
    mcpServers: {
      feishu: {
        command: "bun",
        args: ["run", resolve(PROJECT_ROOT, "packages/feishu-mcp/src/index.ts")],
        env: {
          FEISHU_APP_ID: config.feishu.appId,
          FEISHU_APP_SECRET: config.feishu.appSecret,
        },
      },
    },
  }),
  { mode: 0o600 },
);
const _cleanupMcpConfig = () => { try { unlinkSync(MCP_CONFIG_PATH); } catch { /* already gone */ } };
process.on("exit", _cleanupMcpConfig);
process.on("SIGTERM", () => { _cleanupMcpConfig(); process.exit(0); });
process.on("SIGINT", () => { _cleanupMcpConfig(); process.exit(0); });

// Maximum time allowed for a single Claude CLI invocation
const CLAUDE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface BridgeCallbacks {
  // Return false to abort the Claude process immediately
  onText?: (text: string) => boolean | void;
  onToolUse?: (toolName: string) => void;
  onError?: (error: string) => void;
}

// Patterns that indicate sensitive config/credential content in a response
const SENSITIVE_PATTERNS: RegExp[] = [
  /\bFEISHU_APP_SECRET\s*[:=]\s*\S{4,}/i,
  /\bANTHROPIC_API_KEY\s*[:=]\s*\S{4,}/i,
  /\bFEISHU_APP_ID\s*[:=]\s*cli_\S+/i,
  /\bsk-ant-[A-Za-z0-9\-_]{20,}/,
  // Generic env-var-like line: UPPER_CASE=longvalue (matches .env file content)
  /^[A-Z][A-Z0-9_]{4,}=\S{16,}$/m,
];

export function containsSensitiveContent(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

export const SENSITIVE_CONTENT_ERROR = "SENSITIVE_CONTENT_DETECTED";

interface BridgeResult {
  text: string;
  tools: string[];
  sessionId?: string;
}

export async function runClaude(
  prompt: string,
  session: Session,
  callbacks: BridgeCallbacks = {},
): Promise<BridgeResult> {
  // Group chats use the chatId as the shared workspace; private chats use the userId
  const workspaceId = session.chatId ?? session.userId;
  const worktreePath = ensureUserWorktree(workspaceId);

  const args = [
    "--print",
    "--permission-mode", "auto",
    "--verbose",
    "--output-format", "stream-json",
    "--model", config.claude.model,
    "--system-prompt", config.claude.systemPrompt,
    "--mcp-config", MCP_CONFIG_PATH,
  ];

  if (session.conversationId) {
    args.push("--resume", session.conversationId);
  }

  // "--" separates options from positional args;
  // without it, variadic flags may swallow the prompt
  args.push("--", prompt);

  // Filter out --system-prompt value to avoid logging sensitive content
  const safeArgs = args.filter((_, i) => args[i - 1] !== "--system-prompt");
  console.log(`[Claude] Spawning: claude ${safeArgs.join(" ").slice(0, 150)}...`);

  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn("claude", args, {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(`[Claude] Process spawned, pid: ${proc.pid}`);

    let fullText = "";
    const tools: string[] = [];
    let sessionId: string | undefined;
    let buffer = "";
    let settled = false;

    function abort(reason: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      proc.kill("SIGTERM");
      reject(reason);
    }

    // Extract result event fields (used in both streaming and close handlers)
    function applyResultEvent(event: { session_id?: string; result?: string }) {
      sessionId = event.session_id || sessionId;
      if (!fullText && event.result) fullText = event.result;
    }

    proc.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);

          if (event.type === "assistant") {
            // v2.x format: text in event.message.content[]
            const contentBlocks = event.message?.content;
            if (Array.isArray(contentBlocks)) {
              for (const block of contentBlocks) {
                if (block.type === "text" && block.text) {
                  fullText += block.text;
                  const abortSignal = callbacks.onText?.(block.text);
                  if (abortSignal === false) {
                    abort(new Error(SENSITIVE_CONTENT_ERROR));
                    return;
                  }
                } else if (block.type === "tool_use") {
                  const toolName = block.name || "unknown";
                  tools.push(toolName);
                  callbacks.onToolUse?.(toolName);
                }
              }
            }
            sessionId = event.session_id || sessionId;
          }

          if (event.type === "result") {
            applyResultEvent(event);
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        console.warn(`[Claude] stderr: ${msg.slice(0, 200)}`);
      }
    });

    // Kill process if it runs too long
    const timeoutId = setTimeout(() => {
      abort(new Error(`Claude CLI timed out after ${CLAUDE_TIMEOUT_MS / 60_000} minutes`));
    }, CLAUDE_TIMEOUT_MS);

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      console.log(`[Claude] Process exited with code ${code}, fullText length: ${fullText.length}`);
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          if (event.type === "result") applyResultEvent(event);
        } catch {
          // Ignore
        }
      }

      if (code !== 0 && !fullText) {
        reject(new Error(`Claude CLI exited with code ${code}`));
        return;
      }

      // Persist session ID for future --resume
      if (sessionId) session.conversationId = sessionId;

      resolve({ text: fullText, tools, sessionId });
    });

    proc.on("error", (err) => {
      abort(err);
    });
  });
}
