import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { checkOpenAccess } from "../client.js";
import { CheckOpenAccessInput } from "../types.js";
import { errorResult, missingKeyResult } from "./helpers.js";

export function registerCheckOpenAccessTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "checkOpenAccess",
    {
      title: "Check Open Access",
      description:
        "Check whether a single work is openly accessible and where to find the best legal " +
        "version. Sourced from Unpaywall. Returns OA status (gold/green/hybrid/bronze/closed), " +
        "the best landing or PDF URL, license, and version when available. " +
        "Resolves DOI/PMID/PMCID/arXiv/ISBN/ADS inputs to a DOI before lookup. " +
        "Single identifier only — this tool does not accept batched input.",
      inputSchema: CheckOpenAccessInput,
    },
    async (input) => {
      if (!config.rapidApiKey) return missingKeyResult();

      const result = await checkOpenAccess(config, { id: input.id.trim() });

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
