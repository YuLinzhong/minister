import * as Lark from "@larksuiteoapi/node-sdk";
import { config, readFeishuToken, writeFeishuToken } from "@minister/shared";

const FEISHU_APP_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";
const FEISHU_REFRESH_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token";
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

export type LarkRequestOptions = ReturnType<typeof Lark.withUserAccessToken>;

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isTokenFresh(expiresAt: number): boolean {
  return expiresAt > nowInSeconds() + TOKEN_EXPIRY_BUFFER_SECONDS;
}

function normalizeFeishuScopes(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const scopes = value.filter((scope): scope is string => typeof scope === "string" && scope.length > 0);
    return scopes.length > 0 ? scopes : undefined;
  }
  if (typeof value === "string") {
    const scopes = value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
    return scopes.length > 0 ? scopes : undefined;
  }
  return undefined;
}

function hasRequiredFeishuScopes(scopes: string[] | undefined): boolean {
  if (config.feishu.userScopes.length === 0) return true;
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  const grantedScopes = new Set(scopes);
  return config.feishu.userScopes.every((scope) => grantedScopes.has(scope));
}

async function getAppAccessToken(): Promise<string> {
  const res = await fetch(FEISHU_APP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: config.feishu.appId,
      app_secret: config.feishu.appSecret,
    }),
  });
  const data = await res.json() as any;
  if (data.code !== 0 || !data.app_access_token) {
    throw new Error(`Failed to get app_access_token: ${data.msg || "unknown error"}`);
  }
  return data.app_access_token;
}

async function refreshUserToken(
  openId: string,
  refreshToken: string,
  currentScopes?: string[],
): Promise<string | null> {
  const appAccessToken = await getAppAccessToken();
  const res = await fetch(FEISHU_REFRESH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appAccessToken}`,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json() as any;
  if (data.code !== 0 || !data.data?.access_token) {
    console.error("[lark] Failed to refresh user_access_token:", data);
    return null;
  }

  const now = nowInSeconds();
  const scopes = normalizeFeishuScopes(data.data.scope) || currentScopes;
  writeFeishuToken(openId, {
    access_token: data.data.access_token,
    refresh_token: String(data.data.refresh_token || refreshToken),
    expires_at: now + Number(data.data.expires_in || 0),
    refresh_expires_at: now + Number(data.data.refresh_expires_in || 0),
    scopes,
  });
  return data.data.access_token;
}

export async function getValidUserToken(openId: string): Promise<string | null> {
  const token = readFeishuToken(openId);
  if (!token) return null;
  if (!hasRequiredFeishuScopes(token.scopes)) return null;

  if (token.access_token && isTokenFresh(token.expires_at)) {
    return token.access_token;
  }

  if (!token.refresh_token || !isTokenFresh(token.refresh_expires_at)) {
    return null;
  }

  try {
    return await refreshUserToken(openId, token.refresh_token, token.scopes);
  } catch (error) {
    console.error("[lark] Failed to resolve valid user token:", error);
    return null;
  }
}

export async function getUserTokenOption(openId?: string): Promise<LarkRequestOptions | undefined> {
  if (!openId) return undefined;
  const userAccessToken = await getValidUserToken(openId);
  if (!userAccessToken) return undefined;
  return Lark.withUserAccessToken(userAccessToken);
}
