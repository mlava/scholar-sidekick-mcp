import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { formatCitation } from "../client.js";
import { FormatCitationInput } from "../types.js";
import { buildMetadata, errorResult } from "./helpers.js";

export function registerFormatTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "formatCitation",
    {
      title: "Format Citation",
      description:
        "Format academic citations from identifiers (DOIs, PMIDs, ISBNs, arXiv IDs, etc.) " +
        "into a specific citation style. Returns formatted text, HTML, or structured JSON. " +
        "Supports Vancouver, AMA, APA, IEEE, CSE, and 10,000+ CSL styles.",
      inputSchema: FormatCitationInput,
    },
    async (input) => {
      const result = await formatCitation(config, {
        text: input.text,
        style: input.style ?? undefined,
        lang: input.lang ?? undefined,
        footnote: input.footnote ?? undefined,
        output: input.output ?? "text",
      });

      if (!result.ok || result.data?.ok === false) {
        return errorResult(
          result.data?.ok === false
            ? { ...result, error: result.data.error ?? result.error }
            : result,
        );
      }

      const data = result.data!;
      const output = data.text ?? data.html ?? JSON.stringify(data.items, null, 2);
      const metadata = buildMetadata(result);

      const content: Array<{ type: "text"; text: string }> = [{ type: "text", text: output ?? "" }];

      if (Object.keys(metadata).length > 0) {
        content.push({ type: "text", text: `\n---\nMetadata: ${JSON.stringify(metadata)}` });
      }

      return { content };
    },
  );
}
