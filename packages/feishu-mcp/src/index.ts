// Feishu MCP Server entry point
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolResult } from "@mishu/shared";
import { messageToolDefs, handleMessageTool } from "./tools/message.js";
import { taskToolDefs, handleTaskTool } from "./tools/task.js";
import { contactToolDefs, handleContactTool } from "./tools/contact.js";
import { bitableToolDefs, handleBitableTool } from "./tools/bitable.js";
import { documentToolDefs, handleDocumentTool } from "./tools/document.js";
import { calendarToolDefs, handleCalendarTool } from "./tools/calendar.js";

const allTools = [
  ...messageToolDefs,
  ...taskToolDefs,
  ...contactToolDefs,
  ...bitableToolDefs,
  ...documentToolDefs,
  ...calendarToolDefs,
];

// Build a router map: tool name -> handler function
const toolHandlers = new Map<
  string,
  (args: Record<string, unknown>) => Promise<ToolResult>
>();

for (const def of messageToolDefs)
  toolHandlers.set(def.name, (a) => handleMessageTool(def.name, a));
for (const def of taskToolDefs)
  toolHandlers.set(def.name, (a) => handleTaskTool(def.name, a));
for (const def of contactToolDefs)
  toolHandlers.set(def.name, (a) => handleContactTool(def.name, a));
for (const def of bitableToolDefs)
  toolHandlers.set(def.name, (a) => handleBitableTool(def.name, a));
for (const def of documentToolDefs)
  toolHandlers.set(def.name, (a) => handleDocumentTool(def.name, a));
for (const def of calendarToolDefs)
  toolHandlers.set(def.name, (a) => handleCalendarTool(def.name, a));

const server = new Server(
  { name: "feishu-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers.get(name);
  if (!handler) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    return await handler((args ?? {}) as Record<string, unknown>);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
