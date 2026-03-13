// Shared utility functions for feishu-mcp tool handlers
import type { ToolResult } from "@minister/shared";

/**
 * Convert a date/timestamp string to Unix seconds.
 * Accepts digit-only strings (already in seconds) or ISO date strings.
 */
export function toUnixSeconds(val: string): string {
  if (/^\d+$/.test(val)) return val;
  const ms = new Date(val).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid date/timestamp: ${val}`);
  return String(Math.floor(ms / 1000));
}

export function unknownToolError(name: string): ToolResult {
  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
}

export function getFeishuErrorCode(error: unknown): number | undefined {
  const code = (error as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof code === "number" ? code : undefined;
}

export function isFeishuUserPermissionError(error: unknown): boolean {
  return getFeishuErrorCode(error) === 99991679;
}
