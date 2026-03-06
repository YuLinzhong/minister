// Bridge to Claude Code CLI — spawn process and parse NDJSON stream
import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Session, ClaudeStreamEvent } from "@minister/shared";
import { config } from "@minister/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");

interface BridgeCallbacks {
  onText?: (text: string) => void;
  onToolUse?: (toolName: string) => void;
  onError?: (error: string) => void;
}

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
  const args = [
    "--print",
    "--output-format", "stream-json",
    "--model", config.claude.model,
  ];

  if (session.conversationId) {
    args.push("--resume", session.conversationId);
  }

  args.push(prompt);

  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn("claude", args, {
      cwd: PROJECT_ROOT,
      shell: true,
    });

    let fullText = "";
    const tools: string[] = [];
    let sessionId: string | undefined;
    let buffer = "";

    proc.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event: ClaudeStreamEvent = JSON.parse(trimmed);
          if (event.type === "assistant" && event.subtype === "text") {
            fullText += event.content || "";
            callbacks.onText?.(event.content || "");
          }
          if (event.type === "assistant" && event.subtype === "tool_use") {
            const toolName = event.tool_name || "unknown";
            tools.push(toolName);
            callbacks.onToolUse?.(toolName);
          }
          if (event.type === "result") {
            sessionId = event.session_id;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) callbacks.onError?.(msg);
    });

    proc.on("close", (code) => {
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event: ClaudeStreamEvent = JSON.parse(buffer.trim());
          if (event.type === "result") sessionId = event.session_id;
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

    proc.on("error", reject);
  });
}
