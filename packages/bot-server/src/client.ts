// Feishu REST API client singleton for bot-server
import * as Lark from "@larksuiteoapi/node-sdk";
import { config } from "@mishu/shared";

export const larkClient = new Lark.Client({
  appId: config.feishu.appId,
  appSecret: config.feishu.appSecret,
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu,
});
