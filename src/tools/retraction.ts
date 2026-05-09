import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { checkRetraction } from "../client.js";
import { CheckRetractionInput } from "../types.js";
import { errorResult, missingKeyResult } from "./helpers.js";

export function registerCheckRetractionTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "checkRetraction",
    {
      title: "Check Retraction",
      description:
        "Check whether a single work has been retracted, corrected, or had an expression of " +
        "concern raised. Sourced from Crossref `updated-by` (Retraction Watch). " +
        "Resolves DOI/PMID/PMCID/arXiv/ADS inputs to a DOI before lookup. " +
        "Single identifier only — this tool does not accept batched input.",
      inputSchema: CheckRetractionInput,
    },
    async (input) => {
      if (!config.rapidApiKey) return missingKeyResult();

      const result = await checkRetraction(config, { id: input.id.trim() });

      if (!result.ok || result.data?.ok === false) {
        return errorResult(
          result.data?.ok === false
            ? { ...result, error: result.data.error ?? result.error }
            : result,
        );
      }

      const { ok: _ok, ...payload } = result.data!;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    },
  );
}
