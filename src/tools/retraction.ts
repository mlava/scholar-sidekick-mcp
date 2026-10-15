import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { checkRetraction } from "../client.js";
import { CheckRetractionInput } from "../types.js";
import { errorResult } from "./helpers.js";

export function registerCheckRetractionTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "checkRetraction",
    {
      title: "Check Retraction",
      description:
        "Check whether a single scholarly work has been retracted, corrected, or had an expression " +
        "of concern raised. Use when the user asks 'has this paper been retracted?' or wants to " +
        "verify a paper's standing before citing it (clinical, regulatory, evidence-synthesis " +
        "contexts). To check a WHOLE reference list for retractions (e.g. 'check all these " +
        "citations for retractions' at the end of a literature review, a guideline or a " +
        "systematic review), use auditBibliography instead — one call runs the retraction check " +
        "plus the fabrication check on up to 25 entries. " +
        "Sourced from Crossref `updated-by` (which mirrors Retraction Watch). " +
        "Resolves DOI/PMID/PMCID/arXiv/ADS inputs to a DOI before lookup; ISBN inputs always return " +
        "doi=null and reason='no_doi' since books are not in the retraction graph. " +
        "Single identifier per call — does NOT accept comma/newline batches; for a handful of " +
        "papers loop one call per identifier, for a bibliography use auditBibliography. " +
        "Returns: { doi, resolvedFrom?, reason?, result } where result has isRetracted, hasCorrections, " +
        "hasConcern (booleans), notices (array of {type: 'retraction'|'correction'|'expression-of-concern', " +
        "label, doi, date, source}), and title; result is null when no DOI could be resolved and reason " +
        "explains why ('no_doi'). " +
        "resolveIdentifier returns metadata but not retraction status; auditBibliography includes " +
        "this check for every entry of a bibliography. " +
        "Read-only and idempotent — safe to retry. " +
        "Works anonymously against the public Scholar Sidekick API (rate-limited free tier); " +
        "set SCHOLAR_API_KEY (a free ssk_ key from https://scholar-sidekick.com/account) for higher " +
        "limits, or RAPIDAPI_KEY for paid RapidAPI tiers. Rate limits follow your tier; Crossref is " +
        "queried server-side with its own caching.",
      inputSchema: CheckRetractionInput,
      annotations: {
        title: "Check Retraction",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
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
