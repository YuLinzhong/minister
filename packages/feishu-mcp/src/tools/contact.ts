// P0: Contact tools — search user, get user info
import { larkClient } from "../client.js";
import { isFeishuUserPermissionError, unknownToolError } from "../utils.js";
import type { ToolResult } from "@minister/shared";
import type { LarkRequestOptions } from "../user-token.js";

const CONTACT_SCAN_PAGE_SIZE = 100;
const CONTACT_SCAN_MAX_PAGES = 10;

export const contactToolDefs = [
  {
    name: "contact_search",
    description:
      "Search for a user in the company directory by name or keyword.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search keyword (name, etc)" },
        user_open_id: {
          type: "string",
          description: "Requesting user's open_id, used for user identity access",
        },
        page_size: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
      required: ["query", "user_open_id"],
    },
  },
  {
    name: "contact_get_user",
    description: "Get detailed user information by user_id or open_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_id: { type: "string", description: "User ID or Open ID" },
        user_open_id: {
          type: "string",
          description: "Requesting user's open_id, used for user identity access",
        },
        user_id_type: {
          type: "string",
          enum: ["open_id", "user_id", "union_id"],
          description: "ID type, default open_id",
        },
      },
      required: ["user_id", "user_open_id"],
    },
  },
];

export async function handleContactTool(
  name: string,
  args: Record<string, unknown>,
  larkOptions?: LarkRequestOptions,
): Promise<ToolResult> {
  switch (name) {
    case "contact_search": {
      const users = await searchUsersByName(
        args.query as string,
        (args.page_size as number) || 10,
        larkOptions,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(users, null, 2) }],
      };
    }

    case "contact_get_user": {
      const res = await larkClient.contact.v3.user.get({
        path: { user_id: args.user_id as string },
        params: {
          user_id_type:
            (args.user_id_type as "open_id" | "user_id" | "union_id") ||
            "open_id",
        },
      }, larkOptions);
      const u = res.data?.user;
      const info = {
        open_id: u?.open_id,
        user_id: u?.user_id,
        name: u?.name,
        en_name: u?.en_name,
        email: u?.email,
        mobile: u?.mobile,
        department_ids: u?.department_ids,
        status: u?.status,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    default:
      return unknownToolError(name);
  }
}

function normalizeUserQuery(value: string): string {
  return value.trim().toLowerCase();
}

function userMatchesQuery(
  user: {
    name?: string;
    nickname?: string;
    en_name?: string;
  },
  query: string,
): boolean {
  const normalizedQuery = normalizeUserQuery(query);
  if (!normalizedQuery) return false;
  return [user.name, user.nickname, user.en_name]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeUserQuery(value).includes(normalizedQuery));
}

function mapUserSummary(user: {
  open_id?: string;
  user_id?: string;
  name?: string;
  nickname?: string;
  en_name?: string;
  department_ids?: string[];
  avatar?: { avatar_72?: string };
}): {
  open_id?: string;
  user_id?: string;
  name?: string;
  nickname?: string;
  en_name?: string;
  department_ids?: string[];
  avatar?: string;
} {
  return {
    open_id: user.open_id,
    user_id: user.user_id,
    name: user.name,
    nickname: user.nickname,
    en_name: user.en_name,
    department_ids: user.department_ids,
    avatar: user.avatar?.avatar_72,
  };
}

async function searchUsersByName(
  query: string,
  limit: number,
  larkOptions?: LarkRequestOptions,
): Promise<Array<ReturnType<typeof mapUserSummary>>> {
  try {
    return await searchUsersByNameWithOptions(query, limit, larkOptions);
  } catch (error) {
    if (!larkOptions || !isFeishuUserPermissionError(error)) {
      throw error;
    }
    return searchUsersByNameWithOptions(query, limit, undefined);
  }
}

async function searchUsersByNameWithOptions(
  query: string,
  limit: number,
  larkOptions?: LarkRequestOptions,
): Promise<Array<ReturnType<typeof mapUserSummary>>> {
  const pageSize = Math.max(limit, CONTACT_SCAN_PAGE_SIZE);
  const matches: Array<ReturnType<typeof mapUserSummary>> = [];
  let pageToken: string | undefined;

  for (let page = 0; page < CONTACT_SCAN_MAX_PAGES && matches.length < limit; page += 1) {
    const res = await larkClient.contact.v3.user.list({
      params: {
        user_id_type: "open_id",
        page_size: pageSize,
        page_token: pageToken,
      },
    }, larkOptions);

    const users = res.data?.items ?? [];
    for (const user of users) {
      if (!userMatchesQuery(user, query)) continue;
      matches.push(mapUserSummary(user));
      if (matches.length >= limit) break;
    }

    if (!res.data?.has_more || !res.data.page_token) {
      break;
    }
    pageToken = res.data.page_token;
  }

  return matches.slice(0, limit);
}
