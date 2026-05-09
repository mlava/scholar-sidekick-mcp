import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { type ClientConfig, createConfig } from "./client.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerCheckOpenAccessTool } from "./tools/openAccess.js";
import { registerCheckRetractionTool } from "./tools/retraction.js";
import { registerExportTool } from "./tools/export.js";
import { registerFormatTool } from "./tools/format.js";
import { registerResolveTool } from "./tools/resolve.js";

export const SERVER_NAME = "scholar-sidekick";
export const SERVER_VERSION = "0.6.0";

const SERVER_INSTRUCTIONS = `Scholar Sidekick MCP turns academic identifiers into clean citations and surfaces retraction + open-access status.

When to use this server:
- The user mentions a bibliographic identifier — DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, ADS bibcode, or WHO IRIS URL
- The user asks to format references in a citation style (Vancouver, APA, AMA, IEEE, Chicago, Harvard, MLA, Nature, BMJ, Lancet, or any of 10,000+ CSL styles)
- The user asks to export a bibliography to BibTeX, RIS, EndNote, RefWorks, MEDLINE, Zotero RDF, CSL JSON, or CSV
- The user asks whether a paper has been retracted, corrected, or had an expression of concern raised
- The user asks whether a paper is open access, where to find a free legal copy, or about a paper's OA status

Tool selection:
- resolveIdentifier — when the user wants raw structured metadata (returns CSL JSON: title, authors, journal, year, identifiers)
- formatCitation — when the user wants a human-readable citation in a specific style (returns text, HTML, or JSON)
- exportCitation — when the user wants a downloadable bibliography file (returns the file contents as a string)
- checkRetraction — when the user asks whether a single work has been retracted, corrected, or flagged with an expression of concern (Crossref / Retraction Watch)
- checkOpenAccess — when the user asks whether a single work is openly accessible or wants the best legal URL/license/version (Unpaywall)

Tips:
- resolveIdentifier, formatCitation, and exportCitation accept a single identifier or a comma/newline-separated batch — batch when possible to save calls
- checkRetraction and checkOpenAccess accept ONE identifier per call. For multiple papers, call the tool once per identifier; do not concatenate
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

  registerFormatTool(server, cfg);
  registerExportTool(server, cfg);
  registerResolveTool(server, cfg);
  registerCheckRetractionTool(server, cfg);
  registerCheckOpenAccessTool(server, cfg);
  registerPrompts(server);
  registerResources(server);

  return server;
}
