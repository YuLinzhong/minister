// Common types shared across packages

export interface Session {
  userId: string;
  chatId?: string;
  conversationId?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ClaudeStreamEvent {
  type: "assistant" | "result" | string;
  subtype?: "text" | "tool_use" | string;
  content?: string;
  session_id?: string;
  tool_name?: string;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
