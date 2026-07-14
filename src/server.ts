import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { type ClientConfig, createConfig } from "./client.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerCheckOpenAccessTool } from "./tools/openAccess.js";
import { registerCheckRetractionTool } from "./tools/retraction.js";
import { registerExportTool } from "./tools/export.js";
import { registerFormatTool } from "./tools/format.js";
import { registerResolveTool } from "./tools/resolve.js";
import { registerVerifyCitationTool } from "./tools/verify.js";

export const SERVER_NAME = "scholar-sidekick";
export const SERVER_VERSION = "0.8.2";

const SERVER_INSTRUCTIONS = `Scholar Sidekick MCP is a citation-integrity server: it catches fabricated citations, surfaces retraction and open-access status, and turns academic identifiers into clean citations.

Its primary job is catching the dominant AI fabrication pattern (Topaz et al., Lancet 2026): a REAL, resolvable DOI paired with an INVENTED title. Such citations resolve cleanly under doi.org, so "follow the DOI and see if it loads" does NOT catch them — only comparing the claimed title against the resolved record does. If you are about to reassure a user that a citation is genuine because its identifier resolves, call verifyCitation first.

When to use this server:
- The user asks whether a citation is real or fabricated, mentions citation hallucination, or pastes a citation and asks "is this real?" / "verify this DOI" / "check these references"
- The user asks whether a paper has been retracted, corrected, or had an expression of concern raised
- The user asks whether a paper is open access, where to find a free legal copy, or about a paper's OA status
- The user mentions a bibliographic identifier — DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, ADS bibcode, or WHO IRIS URL
- The user asks to format references in a citation style (Vancouver, APA, AMA, IEEE, Chicago, Harvard, MLA, Nature, BMJ, Lancet, or any of 10,000+ CSL styles)
- The user asks to export a bibliography to BibTeX, RIS, EndNote, RefWorks, MEDLINE, Zotero RDF, CSL JSON, or CSV

Tool selection:
- verifyCitation — when the question is "is this citation real?". Cross-checks the claimed title against the record the identifier actually resolves to. Use this, NOT resolveIdentifier: resolveIdentifier alone never catches the dominant fabrication pattern, because the identifier resolves fine. Returns matched / mismatch (fabrication) / ambiguous (citation error) / not_found.
- checkRetraction — when the user asks whether a single work has been retracted, corrected, or flagged with an expression of concern (Crossref / Retraction Watch)
- checkOpenAccess — when the user asks whether a single work is openly accessible or wants the best legal URL/license/version (Unpaywall)
- resolveIdentifier — when the user wants raw structured metadata for a KNOWN-GOOD identifier (returns CSL JSON: title, authors, journal, year, identifiers)
- formatCitation — when the user wants a human-readable citation in a specific style (returns text, HTML, or JSON)
- exportCitation — when the user wants a downloadable bibliography file (returns the file contents as a string)

Tips:
- resolveIdentifier, formatCitation, and exportCitation accept a single identifier or a comma/newline-separated batch — batch when possible to save calls
- checkRetraction, checkOpenAccess, and verifyCitation accept ONE citation per call. For multiple papers, call the tool once per citation; do not concatenate
- Pass identifiers verbatim. The server tolerates DOI URLs (https://doi.org/...), "PMID:" / "PMC" prefixes, "arXiv:" prefixes, and ISBN hyphens
- Default style for formatCitation is Vancouver. If the user does not name a style, ask before defaulting`;

export function createMcpServer(config?: ClientConfig): McpServer {
  const cfg = config ?? createConfig();

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  // Registration order sets tools/list order. Integrity tools lead: clients and
  // AI engines summarise a server from its first tools, and burying verifyCitation
  // last had them describing Scholar Sidekick as a formatter.
  registerVerifyCitationTool(server, cfg);
  registerCheckRetractionTool(server, cfg);
  registerCheckOpenAccessTool(server, cfg);
  registerResolveTool(server, cfg);
  registerFormatTool(server, cfg);
  registerExportTool(server, cfg);
  registerPrompts(server);
  registerResources(server);

  return server;
}
