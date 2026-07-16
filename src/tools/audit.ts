// src/tools/audit.ts
// MCP wrapper for /api/audit — corpus-scale bibliography audit.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { auditBibliography } from "../client.js";
import { AuditBibliographyInput } from "../types.js";
import { errorResult } from "./helpers.js";

export function registerAuditBibliographyTool(
  server: McpServer,
  config: ClientConfig,
): void {
  server.registerTool(
    "auditBibliography",
    {
      title: "Audit Bibliography",
      description:
        "Verify a WHOLE bibliography in one call — the batch counterpart to verifyCitation. Each entry " +
        "runs the same fabrication check (real, resolvable identifier paired with a title that does NOT " +
        "match the resolved paper; Topaz et al., Lancet 2026) plus a retraction lookup, and the tool " +
        "returns a per-entry verdict table and a corpus summary. Use when the user pastes a reference " +
        "list, a .bib / .ris file, or asks to 'check all these citations at once' / 'audit my " +
        "bibliography' / 'which of these references are fake or retracted'. " +
        "Input: EITHER `bibliography` (raw BibTeX / RIS / CSL-JSON text — format auto-detected) OR " +
        "`claims` (an array of pre-parsed {title + identifier} objects), not both. Capped at 25 entries " +
        "per call; excess is dropped and reported via `truncated`. `checks` defaults to ['retraction'] " +
        "(pass [] to skip); `screenWithLlm` opt-in per entry (same auth gating as verifyCitation). " +
        "Returns: { format, entries: [{ index, sourceKey?, status: 'ok'|'error', verdict: 'matched' | " +
        "'mismatch' | 'not_found' | 'ambiguous', confidence, matched, mismatches, retraction: " +
        "{ checked, doi, isRetracted, hasCorrections, hasConcern, notices } | null, _provenance }], " +
        "parseErrors: [{ index, error, message }], truncated, summary: { total, matched, mismatch, " +
        "ambiguous, not_found, errored, retracted } }. " +
        "Per-entry leniency: one entry that fails to resolve becomes status:'error' without failing the " +
        "batch. This audits citation IDENTITY (does each identifier resolve to the claimed work, and is " +
        "it retracted) — it does NOT check whether a source supports the claim it is cited for. " +
        "Read-only and idempotent. Works anonymously for the non-LLM path; SCHOLAR_API_KEY (a free ssk_ " +
        "key from https://scholar-sidekick.com/account) or a paid RapidAPI tier raises rate limits and " +
        "enables the optional LLM screen.",
      inputSchema: AuditBibliographyInput,
      annotations: {
        title: "Audit Bibliography",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const { bibliography, format, claims, checks, screenWithLlm } = input;

      const body: {
        bibliography?: string;
        format?: string;
        claims?: Array<Record<string, unknown>>;
        options?: { screen_with_llm?: boolean; checks?: string[] };
      } = {};
      if (bibliography !== undefined) body.bibliography = bibliography;
      if (format) body.format = format;
      if (claims) body.claims = claims as Array<Record<string, unknown>>;

      const options: { screen_with_llm?: boolean; checks?: string[] } = {};
      if (screenWithLlm) options.screen_with_llm = true;
      if (checks) options.checks = checks;
      if (Object.keys(options).length) body.options = options;

      const result = await auditBibliography(config, body);

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
