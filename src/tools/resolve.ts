import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { formatCitation } from "../client.js";
import { ResolveIdentifierInput } from "../types.js";
import { errorResult } from "./helpers.js";

export function registerResolveTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "resolveIdentifier",
    {
      title: "Resolve Identifier",
      description:
        "Resolve academic identifiers (DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, " +
        "ISSNs, ADS bibcodes) to structured bibliographic metadata (title, authors, " +
        "journal, year, identifiers, etc.) without formatting. Returns JSON objects.",
      inputSchema: ResolveIdentifierInput,
    },
    async (input) => {
      const result = await formatCitation(config, {
        text: input.text,
        output: "json",
      });

      if (!result.ok || result.data?.ok === false) {
        return errorResult(
          result.data?.ok === false
            ? { ...result, error: result.data.error ?? result.error }
            : result,
        );
      }

      const items = result.data?.items ?? [];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(items, null, 2),
          },
        ],
      };
    },
  );
}
