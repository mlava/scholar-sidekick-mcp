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
        "Check whether a single scholarly work is openly accessible and where to find the best " +
        "legal version. Use when the user asks 'is this open access?', 'where can I read this for " +
        "free?', or wants the OA license/version before reusing or redistributing. " +
        "Sourced from Unpaywall. Resolves DOI/PMID/PMCID/arXiv/ISBN/ADS inputs to a DOI before lookup; " +
        "inputs that don't map to a DOI return doi=null and reason='no_doi'. " +
        "Single identifier per call — does NOT accept comma/newline batches; loop one call per " +
        "identifier for multiple papers. " +
        "Returns: { doi, resolvedFrom?, reason?, result } where result has isOa (boolean), " +
        "oaStatus ('gold' | 'green' | 'hybrid' | 'bronze' | 'closed'), title, " +
        "bestLocation ({url, hostType: 'publisher' | 'repository', license, version: 'submittedVersion' " +
        "| 'acceptedVersion' | 'publishedVersion'} or null), and locations (array of the same shape); " +
        "result is null when no DOI could be resolved and reason explains why ('no_doi'). " +
        "No sibling tool overlaps this — resolveIdentifier returns metadata but not OA status. " +
        "Read-only and idempotent — safe to retry. " +
        "Requires RAPIDAPI_KEY (set via env var or Claude Desktop extension settings); " +
        "without it the tool returns an isError configuration message. " +
        "Rate limits follow the user's RapidAPI subscription plan; Unpaywall is queried server-side " +
        "with its own caching.",
      inputSchema: CheckOpenAccessInput,
      annotations: {
        title: "Check Open Access",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
