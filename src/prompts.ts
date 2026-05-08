import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const IDENTIFIER_DESCRIPTION =
  "Identifier to use (DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, ADS bibcode, or WHO IRIS URL)";

const STYLE_DESCRIPTION =
  "Citation style: vancouver, apa, ama, ieee, cse, or any CSL style ID (e.g. chicago-author-date, harvard-cite-them-right, modern-language-association, nature)";

const FORMAT_DESCRIPTION =
  "Export format: bib (BibTeX), ris, csl (CSL JSON), endnote-xml, endnote-refer, refworks, medline (NBIB), zotero-rdf, csv, txt";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "format",
    {
      title: "Format Citation",
      description: "Format an academic identifier in a specific citation style.",
      argsSchema: {
        identifier: z.string().describe(IDENTIFIER_DESCRIPTION),
        style: z.string().describe(STYLE_DESCRIPTION),
      },
    },
    ({ identifier, style }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Format ${identifier} in ${style} style. Use the formatCitation tool from the scholar-sidekick MCP server. Return the formatted citation along with the provenance metadata block (formatter, styleUsed, requestId, warnings).`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "export",
    {
      title: "Export Citation",
      description: "Resolve an identifier and export it to a bibliography file format.",
      argsSchema: {
        identifier: z.string().describe(IDENTIFIER_DESCRIPTION),
        format: z.string().describe(FORMAT_DESCRIPTION),
      },
    },
    ({ identifier, format }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Resolve ${identifier} and export it as ${format}. Use the exportCitation tool from the scholar-sidekick MCP server with format="${format}". Return the file contents ready to save to disk.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "batch_format",
    {
      title: "Format References (Batch)",
      description: "Format multiple identifiers as a bibliography in a single citation style.",
      argsSchema: {
        identifiers: z
          .string()
          .describe(
            "Identifiers separated by newlines or commas (DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, ADS bibcode, WHO IRIS URL)",
          ),
        style: z.string().describe(STYLE_DESCRIPTION),
      },
    },
    ({ identifiers, style }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Format these references in ${style} style. Use a single formatCitation tool call from the scholar-sidekick MCP server (it accepts the whole batch in the text parameter — do not loop):\n\n${identifiers}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "resolve",
    {
      title: "Resolve Identifier",
      description: "Resolve an identifier to structured bibliographic metadata (CSL JSON).",
      argsSchema: {
        identifier: z.string().describe(IDENTIFIER_DESCRIPTION),
      },
    },
    ({ identifier }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Resolve ${identifier} using the resolveIdentifier tool from the scholar-sidekick MCP server. Return the bibliographic metadata as structured JSON (title, authors, journal, year, identifiers, etc.) without formatting.`,
          },
        },
      ],
    }),
  );
}
