// src/tools/verify.ts
// Phase 12i.6 — MCP wrapper for /api/verify.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { verifyCitation } from "../client.js";
import { VerifyCitationInput } from "../types.js";
import { errorResult, missingKeyResult } from "./helpers.js";

export function registerVerifyCitationTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "verifyCitation",
    {
      title: "Verify Citation",
      description:
        "Verify a claimed citation against the resolved record at its identifier. Detects the dominant " +
        "AI-driven fabrication pattern documented by Topaz et al. (Lancet 2026): a real, resolvable " +
        "identifier (DOI / PMID / PMCID / arXiv / etc.) paired with a title that does NOT correspond to " +
        "the paper at that identifier. Use when the user pastes a citation and asks 'is this real?' or " +
        "'check this DOI' — most fabricated citations resolve cleanly under doi.org but their cited " +
        "title and the resolved title disagree. " +
        "Single citation per call. Required: `title` plus exactly one identifier (doi, pmid, pmcid, isbn, " +
        "arxiv, issn, ads, or whoIrisUrl). Optional refinements: author (first-author family name), year, " +
        "container (journal). Set `screenWithLlm: true` to invoke the Stage 3 LLM screen on " +
        "low-confidence mismatches (catches informal-abbreviation false positives); LLM access is gated " +
        "to authenticated first-party keys and paid RapidAPI tiers — anonymous callers get " +
        "400 LLM_SCREEN_FORBIDDEN. " +
        "Returns: { verdict: 'matched' | 'mismatch' | 'not_found' | 'ambiguous', confidence: 'high' | " +
        "'medium' | 'low', matched: <resolved record or null>, mismatches: [{field, claimed, resolved, " +
        "similarity}], candidates: [{item, registries, score}] (when title-search ran), _provenance: " +
        "{stages_run, resolved_via, registries_searched, llm_screen} }. " +
        "Verdict semantics: 'matched' = claim agrees with resolved record; 'mismatch' = identifier " +
        "resolves but title does not match (Topaz fabrication pattern); 'ambiguous' = identifier " +
        "resolves to one paper but the claimed title matches a DIFFERENT paper found via title-search " +
        "(CITADEL 'citation error' subtype — wrong identifier for a real paper); 'not_found' = neither " +
        "the identifier nor the title resolves anywhere. " +
        "No sibling tool overlaps: resolveIdentifier returns metadata for a known-good identifier; " +
        "verifyCitation is the only tool that cross-checks claimed title vs resolved metadata. " +
        "Read-only and idempotent — safe to retry. Requires RAPIDAPI_KEY (or set SCHOLAR_SIDEKICK_URL " +
        "to use a first-party key); without authentication the anonymous tier still works for the " +
        "non-LLM path but the LLM screen is unavailable.",
      inputSchema: VerifyCitationInput,
      annotations: {
        title: "Verify Citation",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      if (!config.rapidApiKey) return missingKeyResult();

      // Bundle the flat MCP input into the API's `claimed` + `options` shape.
      const {
        screenWithLlm,
        author,
        title,
        doi,
        pmid,
        pmcid,
        isbn,
        arxiv,
        issn,
        ads,
        whoIrisUrl,
        year,
        container,
      } = input;

      const claimed: Record<string, unknown> = { title };
      if (doi) claimed.doi = doi;
      if (pmid) claimed.pmid = pmid;
      if (pmcid) claimed.pmcid = pmcid;
      if (isbn) claimed.isbn = isbn;
      if (arxiv) claimed.arxiv = arxiv;
      if (issn) claimed.issn = issn;
      if (ads) claimed.ads = ads;
      if (whoIrisUrl) claimed.whoIrisUrl = whoIrisUrl;
      if (year !== undefined) claimed.year = year;
      if (container) claimed.container = container;
      if (author) claimed.authors = [{ family: author }];

      const body: {
        claimed: Record<string, unknown>;
        options?: { screen_with_llm?: boolean };
      } = { claimed };
      if (screenWithLlm) body.options = { screen_with_llm: true };

      const result = await verifyCitation(config, body);

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
