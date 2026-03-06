// Common types shared across packages

export interface Session {
  userId: string;
  chatId?: string;
  conversationId?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  content?: string;
  session_id?: string;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
