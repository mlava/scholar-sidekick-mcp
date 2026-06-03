import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { exportCitation } from "../client.js";
import { ExportCitationInput } from "../types.js";
import { errorResult, normalizeIdentifiers } from "./helpers.js";

export function registerExportTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "exportCitation",
    {
      title: "Export Citation",
      description:
        "Export scholarly identifiers to a bibliography file format ready to write to disk or paste " +
        "into a reference manager. Use when the user wants a file (.bib, .ris, .nbib, .xml, .rdf, " +
        ".csv) for Zotero, Mendeley, EndNote, RefWorks, BibTeX/LaTeX, Pandoc, or Excel. " +
        "Format parameter is required: bib (BibTeX — LaTeX), ris (RIS — most widely supported by " +
        "reference managers), csl (CSL JSON — Pandoc/Quarto), endnote-xml, endnote-refer, refworks, " +
        "medline (NBIB — PubMed round-trips, clinical workflows), zotero-rdf, csv (spreadsheet-friendly), " +
        "or txt (plain-text bibliography rendered with the optional style parameter — txt is the only " +
        "format that uses style; the others have their own structured shape and ignore it). " +
        "Accepts the same identifier formats as resolveIdentifier (DOI/PMID/PMCID/ISBN/arXiv/ISSN/ADS/" +
        "WHO IRIS, prefixes tolerated), single or comma/newline-separated batch — one round trip per call. " +
        "Returns: { content: string, format: string } where content is the entire bibliography in the " +
        "requested format as a single string — write it to a file (.bib/.ris/.nbib/etc.) or paste it " +
        "directly into the target tool. " +
        "Use formatCitation instead when the user wants in-line citation text (manuscript, slide); " +
        "use resolveIdentifier when they want raw structured metadata. " +
        "Read-only and idempotent — safe to retry. " +
        "Works anonymously against the public Scholar Sidekick API (rate-limited free tier); " +
        "set SCHOLAR_API_KEY (a free ssk_ key from https://scholar-sidekick.com/account) for higher " +
        "limits, or RAPIDAPI_KEY for paid RapidAPI tiers. Rate limits follow your tier.",
      inputSchema: ExportCitationInput,
      annotations: {
        title: "Export Citation",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      const result = await exportCitation(config, {
        text: normalizeIdentifiers(input.text),
        format: input.format,
        style: input.style ?? undefined,
        lang: input.lang ?? undefined,
      });

      if (!result.ok) {
        return errorResult(result);
      }

      return {
        content: [{ type: "text" as const, text: result.data ?? "" }],
      };
    },
  );
}
