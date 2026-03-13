// P1: Calendar tools — create event, query events, freebusy
import { larkClient } from "../client.js";
import { isFeishuUserPermissionError, toUnixSeconds, unknownToolError } from "../utils.js";
import type { ToolResult } from "@minister/shared";
import type { LarkRequestOptions } from "../user-token.js";

// Cache the Promise itself so concurrent callers share a single in-flight request
let appPrimaryCalendarIdPromise: Promise<string> | undefined;

function pickPreferredCalendarId(
  calendars: Array<{ calendar_id?: string; is_primary?: boolean; role?: string }>,
): string {
  const primary = calendars.find((calendar) => calendar.is_primary);
  const owned = calendars.find((calendar) => calendar.role === "owner");
  const writable = calendars.find((calendar) => calendar.role === "writer");
  return (primary || owned || writable || calendars[0])?.calendar_id || "primary";
}

function getAppPrimaryCalendarId(): Promise<string> {
  if (!appPrimaryCalendarIdPromise) {
    appPrimaryCalendarIdPromise = (async () => {
      const calList = await larkClient.calendar.v4.calendar.list({});
      return pickPreferredCalendarId(calList.data?.calendar_list ?? []);
    })();
  }
  return appPrimaryCalendarIdPromise;
}

async function getUserPrimaryCalendarId(larkOptions: LarkRequestOptions): Promise<string> {
  const calList = await larkClient.calendar.v4.calendar.list({}, larkOptions);
  return pickPreferredCalendarId(calList.data?.calendar_list ?? []);
}

async function resolveCalendarContext(
  larkOptions?: LarkRequestOptions,
  explicitCalendarId?: string,
): Promise<{
  calendarId: string;
  requestOptions?: LarkRequestOptions;
  usingUserIdentity: boolean;
}> {
  if (!larkOptions) {
    const calendarId = explicitCalendarId || await getAppPrimaryCalendarId();
    return { calendarId, requestOptions: undefined, usingUserIdentity: false };
  }

  try {
    const calendarId = explicitCalendarId || await getUserPrimaryCalendarId(larkOptions);
    return { calendarId, requestOptions: larkOptions, usingUserIdentity: true };
  } catch (error) {
    if (!isFeishuUserPermissionError(error)) {
      throw error;
    }
    const calendarId = explicitCalendarId || await getAppPrimaryCalendarId();
    return { calendarId, requestOptions: undefined, usingUserIdentity: false };
  }
}

async function runReadOnlyCalendarOperation<T>(
  operation: (context: {
    calendarId: string;
    requestOptions?: LarkRequestOptions;
    usingUserIdentity: boolean;
  }) => Promise<T>,
  larkOptions?: LarkRequestOptions,
  explicitCalendarId?: string,
): Promise<T> {
  const context = await resolveCalendarContext(larkOptions, explicitCalendarId);
  try {
    return await operation(context);
  } catch (error) {
    if (!context.usingUserIdentity || !isFeishuUserPermissionError(error)) {
      throw error;
    }
    return operation(await resolveCalendarContext(undefined, explicitCalendarId));
  }
}

export const calendarToolDefs = [
  {
    name: "cal_create_event",
    description:
      "Create a calendar event in the primary calendar. Can invite attendees.",
    inputSchema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Event title" },
        description: { type: "string", description: "Event description" },
        start_time: {
          type: "string",
          description: "Start time (Unix timestamp in seconds or ISO string)",
        },
        end_time: {
          type: "string",
          description: "End time (Unix timestamp in seconds or ISO string)",
        },
        user_open_id: {
          type: "string",
          description: "Requesting user's open_id, used to find their primary calendar",
        },
        attendees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["user", "chat", "resource"],
                description: "Attendee type",
              },
              user_id: { type: "string", description: "User open_id" },
              chat_id: {
                type: "string",
                description: "Chat ID (for group events)",
              },
            },
          },
          description: "Event attendees",
        },
      },
      required: ["summary", "start_time", "end_time", "user_open_id"],
    },
  },
  {
    name: "cal_query_events",
    description: "Query calendar events within a time range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        calendar_id: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        user_open_id: {
          type: "string",
          description: "Requesting user's open_id, used for user identity access",
        },
        start_time: {
          type: "string",
          description: "Range start (Unix timestamp in seconds)",
        },
        end_time: {
          type: "string",
          description: "Range end (Unix timestamp in seconds)",
        },
      },
      required: ["start_time", "end_time", "user_open_id"],
    },
  },
  {
    name: "cal_freebusy",
    description:
      "Query free/busy status for one or more users within a time range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        user_open_id: {
          type: "string",
          description: "Requesting user's open_id, used for user identity access",
        },
        user_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of user open_ids to query",
        },
        start_time: {
          type: "string",
          description: "Range start (Unix timestamp in seconds)",
        },
        end_time: {
          type: "string",
          description: "Range end (Unix timestamp in seconds)",
        },
      },
      required: ["user_ids", "start_time", "end_time", "user_open_id"],
    },
  },
];

export async function handleCalendarTool(
  name: string,
  args: Record<string, unknown>,
  larkOptions?: LarkRequestOptions,
): Promise<ToolResult> {
  switch (name) {
    case "cal_create_event": {
      const userOpenId = args.user_open_id as string | undefined;
      const extraAttendees = args.attendees as
        | Array<{ type?: string; user_id?: string; chat_id?: string }>
        | undefined;

      const startTs = toUnixSeconds(args.start_time as string);
      const endTs = toUnixSeconds(args.end_time as string);
      let context = await resolveCalendarContext(larkOptions);
      let res;
      try {
        res = await larkClient.calendar.v4.calendarEvent.create({
          path: { calendar_id: context.calendarId },
          data: {
            summary: args.summary as string,
            description: (args.description as string) || undefined,
            start_time: { timestamp: startTs },
            end_time: { timestamp: endTs },
            attendee_ability: "can_modify_event",
          },
        }, context.requestOptions);
      } catch (error) {
        if (!context.usingUserIdentity || !isFeishuUserPermissionError(error)) {
          throw error;
        }
        context = await resolveCalendarContext(undefined);
        res = await larkClient.calendar.v4.calendarEvent.create({
          path: { calendar_id: context.calendarId },
          data: {
            summary: args.summary as string,
            description: (args.description as string) || undefined,
            start_time: { timestamp: startTs },
            end_time: { timestamp: endTs },
            attendee_ability: "can_modify_event",
          },
        }, context.requestOptions);
      }

      const eventId = res.data?.event?.event_id;
      if (eventId) {
        const allAttendees: Array<{ type: "user" | "chat" | "resource"; user_id?: string; chat_id?: string }> = [];
        if (userOpenId && !context.usingUserIdentity) {
          allAttendees.push({ type: "user", user_id: userOpenId });
        }
        if (extraAttendees?.length) {
          for (const attendee of extraAttendees) {
            allAttendees.push({
              type: (attendee.type as "user" | "chat" | "resource") || "user",
              user_id: attendee.user_id,
              chat_id: attendee.chat_id,
            });
          }
        }
        if (allAttendees.length > 0) {
          await larkClient.calendar.v4.calendarEventAttendee.create({
            path: { calendar_id: context.calendarId, event_id: eventId },
            params: { user_id_type: "open_id" },
            data: { attendees: allAttendees },
          }, context.requestOptions);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Event created. event_id: ${eventId}, summary: ${args.summary}, identity: ${context.usingUserIdentity ? "user" : "app_fallback"}`,
          },
        ],
      };
    }

    case "cal_query_events": {
      const res = await runReadOnlyCalendarOperation(({ calendarId, requestOptions }) => {
        return larkClient.calendar.v4.calendarEvent.list({
          path: { calendar_id: calendarId },
          params: {
            start_time: toUnixSeconds(args.start_time as string),
            end_time: toUnixSeconds(args.end_time as string),
            page_size: 50,
          },
        }, requestOptions);
      }, larkOptions, args.calendar_id as string | undefined);
      const events = (res.data?.items ?? []).map((e) => ({
        event_id: e.event_id,
        summary: e.summary,
        start_time: e.start_time,
        end_time: e.end_time,
        status: e.status,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
      };
    }

    case "cal_freebusy": {
      const userIds = args.user_ids as string[];
      // SDK types define user_id as string, but the actual API accepts an object
      // with { user_ids: string[], id_type: string } for batch querying.
      const res = await larkClient.calendar.v4.freebusy.list({
        data: {
          time_min: toUnixSeconds(args.start_time as string),
          time_max: toUnixSeconds(args.end_time as string),
          user_id: { user_ids: userIds, id_type: "open_id" } as any,
        },
      }, larkOptions);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res.data?.freebusy_list ?? [], null, 2),
          },
        ],
      };
    }

    default:
      return unknownToolError(name);
  }
}
