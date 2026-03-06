// Bot Server entry point — WebSocket long-connection to Feishu
import * as Lark from "@larksuiteoapi/node-sdk";
import { config } from "@mishu/shared";
import { handleMessage } from "./message-handler.js";

const wsClient = new Lark.WSClient({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  loggerLevel: Lark.LoggerLevel.info,
});

console.log("[Mishu] Starting bot server...");

wsClient.start({
  eventDispatcher: new Lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      try {
        await handleMessage(data as any);
      } catch (err) {
        console.error("[Mishu] Message handler error:", err);
      }
    },
  }),
});

console.log("[Mishu] Bot server started. Listening for messages...");
