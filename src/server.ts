import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { type ClientConfig, createConfig } from "./client.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerExportTool } from "./tools/export.js";
import { registerFormatTool } from "./tools/format.js";
import { registerResolveTool } from "./tools/resolve.js";

export const SERVER_NAME = "scholar-sidekick";
export const SERVER_VERSION = "0.4.1";

const SERVER_INSTRUCTIONS = `Scholar Sidekick MCP turns academic identifiers into clean citations.

When to use this server:
- The user mentions a bibliographic identifier — DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, ADS bibcode, or WHO IRIS URL
- The user asks to format references in a citation style (Vancouver, APA, AMA, IEEE, Chicago, Harvard, MLA, Nature, BMJ, Lancet, or any of 10,000+ CSL styles)
- The user asks to export a bibliography to BibTeX, RIS, EndNote, RefWorks, MEDLINE, Zotero RDF, CSL JSON, or CSV

Tool selection:
- resolveIdentifier — when the user wants raw structured metadata (returns CSL JSON: title, authors, journal, year, identifiers)
- formatCitation — when the user wants a human-readable citation in a specific style (returns text, HTML, or JSON)
- exportCitation — when the user wants a downloadable bibliography file (returns the file contents as a string)

Tips:
- All tools accept multiple identifiers separated by newlines or commas — batch when possible to save calls
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
  registerPrompts(server);
  registerResources(server);

  return server;
}
