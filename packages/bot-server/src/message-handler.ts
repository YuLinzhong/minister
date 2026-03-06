// Message routing: parse incoming Feishu events, dispatch to Claude
import { larkClient as client } from "./client.js";
import { sessionManager } from "./session-manager.js";
import { runClaude } from "./claude-bridge.js";
import {
  buildThinkingCard,
  buildResultCard,
  buildProgressCard,
  buildErrorCard,
} from "./card-builder.js";

// Throttle card updates to avoid Feishu rate limits (>= 1.5s between updates)
const MIN_UPDATE_INTERVAL = 1500;
const lastUpdateTime = new Map<string, number>();

function canUpdate(messageId: string): boolean {
  const now = Date.now();
  const last = lastUpdateTime.get(messageId) || 0;
  if (now - last < MIN_UPDATE_INTERVAL) return false;
  lastUpdateTime.set(messageId, now);
  return true;
}

async function sendCard(chatId: string, cardJson: string): Promise<string | undefined> {
  const res = await client.im.v1.message.create({
    params: { receive_id_type: "chat_id" },
    data: {
      receive_id: chatId,
      content: cardJson,
      msg_type: "interactive",
    },
  });
  return res.data?.message_id;
}

async function updateCard(messageId: string, cardJson: string): Promise<void> {
  if (!canUpdate(messageId)) return;
  await client.im.v1.message.patch({
    path: { message_id: messageId },
    data: { content: cardJson },
  });
}

function extractText(message: { content?: string; mentions?: Array<{ key: string }> }): string {
  if (!message.content) return "";
  try {
    const parsed = JSON.parse(message.content);
    let text: string = parsed.text || "";
    // Remove @mention placeholders like @_user_1
    if (message.mentions) {
      for (const m of message.mentions) {
        text = text.replace(m.key, "");
      }
    }
    return text.trim();
  } catch {
    return message.content;
  }
}

export async function handleMessage(data: {
  sender: { sender_id: { open_id?: string; user_id?: string }; sender_type: string };
  message: {
    message_id: string;
    chat_id: string;
    chat_type: string;
    message_type: string;
    content?: string;
    mentions?: Array<{ key: string; id: { open_id?: string }; name: string }>;
  };
}): Promise<void> {
  const { sender, message } = data;

  // Only handle text messages
  if (message.message_type !== "text") return;

  // In group chat, only respond when @mentioned
  if (message.chat_type === "group" && !message.mentions?.length) return;

  const userId = sender.sender_id.open_id || sender.sender_id.user_id || "unknown";
  const text = extractText(message);

  if (!text) return;

  // Quick ping/pong test
  if (text.toLowerCase() === "ping") {
    await client.im.v1.message.reply({
      path: { message_id: message.message_id },
      data: {
        content: JSON.stringify({ text: "pong" }),
        msg_type: "text",
      },
    });
    return;
  }

  // Get or create session for this user
  const session = sessionManager.getOrCreate(userId, message.chat_id);

  // Send "thinking" card
  const cardMsgId = await sendCard(message.chat_id, buildThinkingCard());
  if (!cardMsgId) return;

  try {
    const tools: string[] = [];

    const result = await runClaude(text, session, {
      onText: (chunk) => {
        // Stream partial text to card
        updateCard(
          cardMsgId,
          buildProgressCard({
            title: "Minister is thinking...",
            content: chunk,
            tools,
            status: "Processing...",
          }),
        ).catch((e) => console.warn("[Minister] Card update failed:", e));
      },
      onToolUse: (toolName) => {
        tools.push(toolName);
        updateCard(
          cardMsgId,
          buildProgressCard({
            title: "Minister is working...",
            content: "Calling tools...",
            tools,
            status: `Using: ${toolName}`,
          }),
        ).catch((e) => console.warn("[Minister] Card update failed:", e));
      },
    });

    // Final result card
    await updateCard(cardMsgId, buildResultCard(result.text || "Done. No text output."));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateCard(cardMsgId, buildErrorCard(msg));
  } finally {
    lastUpdateTime.delete(cardMsgId);
  }
}
