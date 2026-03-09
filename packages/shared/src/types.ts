// Common types shared across packages

export interface Session {
  userId: string;
  chatId?: string;
  conversationId?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
