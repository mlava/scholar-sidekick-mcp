import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { type ClientConfig, createConfig } from "./client.js";
import { registerExportTool } from "./tools/export.js";
import { registerFormatTool } from "./tools/format.js";
import { registerResolveTool } from "./tools/resolve.js";

export const SERVER_NAME = "scholar-sidekick";
export const SERVER_VERSION = "0.3.0";

export function createMcpServer(config?: ClientConfig): McpServer {
  const cfg = config ?? createConfig();

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerFormatTool(server, cfg);
  registerExportTool(server, cfg);
  registerResolveTool(server, cfg);

  return server;
}
