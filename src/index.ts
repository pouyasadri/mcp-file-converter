import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dispatchTool, listTools } from "./tools/catalog.js";

const mcpServer = new McpServer(
  { name: "file-converter", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: listTools(),
}));

mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    return await dispatchTool(request.params.name, {
      arguments: request.params.arguments as Record<string, unknown> | undefined,
    }) as any;
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
