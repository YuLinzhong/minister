// P1: Document tools — create, read, update
import { larkClient } from "../client.js";
import type { ToolResult } from "@mishu/shared";

export const documentToolDefs = [
  {
    name: "doc_create",
    description: "Create a new Feishu document.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Document title" },
        folder_token: {
          type: "string",
          description: "Folder token to create in (optional)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "doc_read",
    description: "Read content of a Feishu document by document_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: { type: "string", description: "Document ID" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "doc_update",
    description:
      "Append content to a Feishu document. Content is provided as an array of block operations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: { type: "string", description: "Document ID" },
        content: {
          type: "string",
          description:
            "Markdown-like text content to append. Will be converted to document blocks.",
        },
      },
      required: ["document_id", "content"],
    },
  },
];

export async function handleDocumentTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "doc_create": {
      const res = await larkClient.docx.v1.document.create({
        data: {
          title: args.title as string,
          folder_token: (args.folder_token as string) || undefined,
        },
      });
      const doc = res.data?.document;
      return {
        content: [
          {
            type: "text",
            text: `Document created. document_id: ${doc?.document_id}, title: ${doc?.title}`,
          },
        ],
      };
    }

    case "doc_read": {
      const res = await larkClient.docx.v1.document.rawContent({
        path: { document_id: args.document_id as string },
      });
      return {
        content: [
          { type: "text", text: res.data?.content || "(empty document)" },
        ],
      };
    }

    case "doc_update": {
      // Create a text block and append to document body
      const content = args.content as string;
      await larkClient.docx.v1.documentBlock.childrenBatchCreate({
        path: {
          document_id: args.document_id as string,
          block_id: args.document_id as string, // root block ID equals document ID
        },
        data: {
          children: [
            {
              block_type: 2, // text block
              text: {
                elements: [
                  {
                    text_run: { content },
                  },
                ],
                style: {},
              },
            },
          ],
          index: -1,
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Content appended to document ${args.document_id}.`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown document tool: ${name}` }],
        isError: true,
      };
  }
}
