// Manage per-user Claude Code sessions
import type { Session } from "@mishu/shared";

const sessions = new Map<string, Session>();

function sessionKey(userId: string, chatId?: string): string {
  // Private chat: keyed by userId only. Group chat: keyed by userId + chatId.
  return chatId ? `${userId}:${chatId}` : userId;
}

export const sessionManager = {
  getOrCreate(userId: string, chatId?: string): Session {
    const key = sessionKey(userId, chatId);
    let session = sessions.get(key);
    if (!session) {
      session = {
        userId,
        chatId,
        conversationId: undefined,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      sessions.set(key, session);
    }
    session.lastActiveAt = Date.now();
    return session;
  },

  /** System session for cron jobs, no specific user */
  getSystemSession(): Session {
    return this.getOrCreate("__system__");
  },
};
