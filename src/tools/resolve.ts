import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { formatCitation } from "../client.js";
import { ResolveIdentifierInput } from "../types.js";
import { errorResult, missingKeyResult, normalizeIdentifiers } from "./helpers.js";

export function registerResolveTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "resolveIdentifier",
    {
      title: "Resolve Identifier",
      description:
        "Resolve scholarly identifiers to structured CSL JSON metadata (title, authors, journal, " +
        "year, identifiers). Use when the user wants raw bibliographic data to inspect, transform, " +
        "or feed into another tool — not a formatted citation. " +
        "Accepts DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, NASA ADS bibcode, or WHO IRIS URL, " +
        "with or without prefixes (PMID:, arXiv:, ISBN hyphens, https://doi.org/...). " +
        "Pass a single identifier or a comma/newline-separated batch — one round trip per call. " +
        "Returns: a JSON array of CSL items, each with id, type, title, author[], issued.date-parts, " +
        "container-title, DOI/PMID/PMCID/ISBN/ISSN/URL when available. " +
        "Use formatCitation instead when the user wants a finished citation string in a specific style; " +
        "use exportCitation when they want a downloadable bibliography file. " +
        "Read-only and idempotent — safe to retry. " +
        "Requires RAPIDAPI_KEY (set via env var or Claude Desktop extension settings); " +
        "without it the tool returns an isError configuration message. " +
        "Rate limits follow the user's RapidAPI subscription plan; the underlying REST API caches " +
        "repeated identical requests and surfaces cache state in the x-scholar-cache response header.",
      inputSchema: ResolveIdentifierInput,
      annotations: {
        title: "Resolve Identifier",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      if (!config.rapidApiKey) return missingKeyResult();

      const result = await formatCitation(config, {
        text: normalizeIdentifiers(input.text),
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
