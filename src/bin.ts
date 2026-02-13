import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createConfig } from "./client.js";
import { createMcpServer } from "./server.js";

async function checkConnection(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      process.stderr.write(`Connected to Scholar Sidekick at ${baseUrl}\n`);
    } else {
      process.stderr.write(`Warning: Scholar Sidekick returned HTTP ${res.status} at ${baseUrl}\n`);
    }
  } catch {
    process.stderr.write(
      `Warning: cannot reach Scholar Sidekick at ${baseUrl}. ` +
        `Ensure the server is running or set SCHOLAR_SIDEKICK_URL.\n`,
    );
  }
}

async function main(): Promise<void> {
  const config = createConfig();
  await checkConnection(config.baseUrl);

  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`Scholar Sidekick MCP server started (target: ${config.baseUrl})\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
