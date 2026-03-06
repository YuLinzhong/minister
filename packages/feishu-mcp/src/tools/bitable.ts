// P1: Bitable (multi-dimensional table) tools
import { larkClient } from "../client.js";
import type { ToolResult } from "@mishu/shared";

export const bitableToolDefs = [
  {
    name: "bitable_create_app",
    description: "Create a new Bitable (multi-dimensional spreadsheet) app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Bitable app name" },
        folder_token: {
          type: "string",
          description: "Folder token to create in (optional)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "bitable_create_record",
    description: "Create a record (row) in a Bitable table.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string", description: "Bitable app token" },
        table_id: { type: "string", description: "Table ID" },
        fields: {
          type: "object",
          description:
            "Field name-value pairs. e.g. { '任务名称': 'Do X', '状态': '进行中' }",
        },
      },
      required: ["app_token", "table_id", "fields"],
    },
  },
  {
    name: "bitable_query",
    description:
      "Query records from a Bitable table. Supports filter and sort.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string", description: "Bitable app token" },
        table_id: { type: "string", description: "Table ID" },
        filter: {
          type: "string",
          description:
            'Filter expression, e.g. AND(CurrentValue.[状态]="进行中")',
        },
        sort: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field_name: { type: "string" },
              desc: { type: "boolean" },
            },
          },
          description: "Sort conditions",
        },
        page_size: { type: "number", description: "Max records (default 20)" },
      },
      required: ["app_token", "table_id"],
    },
  },
  {
    name: "bitable_update_record",
    description: "Update an existing record in a Bitable table.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_token: { type: "string", description: "Bitable app token" },
        table_id: { type: "string", description: "Table ID" },
        record_id: { type: "string", description: "Record ID to update" },
        fields: {
          type: "object",
          description: "Field name-value pairs to update",
        },
      },
      required: ["app_token", "table_id", "record_id", "fields"],
    },
  },
];

export async function handleBitableTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "bitable_create_app": {
      const res = await larkClient.bitable.v1.app.create({
        data: {
          name: args.name as string,
          folder_token: (args.folder_token as string) || undefined,
        },
      });
      const app = res.data?.app;
      return {
        content: [
          {
            type: "text",
            text: `Bitable created. app_token: ${app?.app_token}, name: ${app?.name}`,
          },
        ],
      };
    }

    case "bitable_create_record": {
      const res = await larkClient.bitable.v1.appTableRecord.create({
        path: {
          app_token: args.app_token as string,
          table_id: args.table_id as string,
        },
        data: { fields: args.fields as Record<string, unknown> },
      });
      return {
        content: [
          {
            type: "text",
            text: `Record created. record_id: ${res.data?.record?.record_id}`,
          },
        ],
      };
    }

    case "bitable_query": {
      const res = await larkClient.bitable.v1.appTableRecord.list({
        path: {
          app_token: args.app_token as string,
          table_id: args.table_id as string,
        },
        params: {
          filter: (args.filter as string) || undefined,
          sort: args.sort ? JSON.stringify(args.sort) : undefined,
          page_size: (args.page_size as number) || 20,
        },
      });
      const records = (res.data?.items ?? []).map((r) => ({
        record_id: r.record_id,
        fields: r.fields,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(records, null, 2) }],
      };
    }

    case "bitable_update_record": {
      await larkClient.bitable.v1.appTableRecord.update({
        path: {
          app_token: args.app_token as string,
          table_id: args.table_id as string,
          record_id: args.record_id as string,
        },
        data: { fields: args.fields as Record<string, unknown> },
      });
      return {
        content: [
          {
            type: "text",
            text: `Record ${args.record_id} updated successfully.`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown bitable tool: ${name}` }],
        isError: true,
      };
  }
}
