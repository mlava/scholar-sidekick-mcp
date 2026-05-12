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

  server.registerPrompt(
    "retraction",
    {
      title: "Check Retraction",
      description:
        "Check whether a paper has been retracted, corrected, or had an expression of concern raised.",
      argsSchema: {
        identifier: z
          .string()
          .describe(
            "Identifier to check (DOI, PMID, PMCID, arXiv ID, or ADS bibcode). Single identifier only.",
          ),
      },
    },
    ({ identifier }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Check whether ${identifier} has been retracted, corrected, or had an expression of concern raised. Use the checkRetraction tool from the scholar-sidekick MCP server. Report the retraction status (isRetracted/hasCorrections/hasConcern), the resolved DOI, and any notices found (sourced from Crossref / Retraction Watch).`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "open_access",
    {
      title: "Check Open Access",
      description: "Check whether a paper is open access and find the best legal copy.",
      argsSchema: {
        identifier: z
          .string()
          .describe(
            "Identifier to check (DOI, PMID, PMCID, arXiv ID, ISBN, or ADS bibcode). Single identifier only.",
          ),
      },
    },
    ({ identifier }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Check whether ${identifier} is open access using the checkOpenAccess tool from the scholar-sidekick MCP server. Report the OA status (gold/green/hybrid/bronze/closed) and, when available, the best landing or PDF URL with its license and version (sourced from Unpaywall).`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "verify",
    {
      title: "Verify Citation",
      description:
        "Check whether a claimed citation matches the paper at its identifier (detects AI-driven citation fabrication).",
      argsSchema: {
        title: z.string().describe("The cited title (the title as it appears in the bibliography)."),
        identifier: z
          .string()
          .describe(
            "The cited identifier (DOI, PMID, PMCID, ISBN, arXiv ID, ISSN, ADS bibcode, or WHO IRIS URL). Single identifier only.",
          ),
      },
    },
    ({ title, identifier }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Verify this citation using the verifyCitation tool from the scholar-sidekick MCP server. The cited title is "${title}" and the cited identifier is ${identifier}. Detect the identifier type (DOI starts with "10.", PMID is numeric, PMCID starts with "PMC", arXiv ID matches YYYY.NNNNN or has the "arXiv:" prefix, ISBN is 10/13 digits, etc.) and pass it in the appropriate field. Report the verdict (matched / mismatch / ambiguous / not_found), the confidence, and — if there is any mismatch — what the resolved record at that identifier actually says, so the user can see where the cited title and the resolved title diverged. This is the check that catches the dominant AI-citation-fabrication pattern documented by Topaz et al. (Lancet 2026).`,
          },
        },
      ],
    }),
  );
}
