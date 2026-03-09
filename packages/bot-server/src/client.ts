// Feishu REST API client singleton for bot-server
import * as Lark from "@larksuiteoapi/node-sdk";
import { config } from "@minister/shared";

export const larkClient = new Lark.Client({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu,
});

// Lazy-fetched bot open_id; used to filter group-chat @mentions.
// Fetched on demand rather than at startup because the Lark SDK's REST token
// may not be available during the initial startup window.
let cachedBotOpenId: string | null | undefined;

export async function getBotOpenId(): Promise<string | null> {
  if (cachedBotOpenId !== undefined) return cachedBotOpenId;
  try {
    const res = await larkClient.request<{
      code?: number;
      bot?: { open_id?: string };
    }>({ url: "/open-apis/bot/v3/info/", method: "GET" });
    const openId = res.bot?.open_id ?? null;
    if (openId) {
      console.log(`[Minister] Bot open_id: ${openId}`);
      cachedBotOpenId = openId;
    }
    return openId;
  } catch (err) {
    // Don't cache failures — retry on next call
    console.warn("[Minister] Failed to fetch bot info:", err instanceof Error ? err.message : err);
    return null;
  }
}
