import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const IDENTIFIERS_TEXT = `# Supported Identifier Types

Scholar Sidekick MCP resolves any of the following scholarly identifiers. All
three tools (\`resolveIdentifier\`, \`formatCitation\`, \`exportCitation\`)
accept a single identifier or a comma- or newline-separated batch.

| Type | Example | Notes |
| --- | --- | --- |
| DOI | \`10.1056/NEJMoa2033700\` | URL form (\`https://doi.org/...\`) also accepted |
| PubMed ID | \`PMID:30049270\` or \`30049270\` | \`PMID:\` prefix optional |
| PubMed Central ID | \`PMC7793608\` or \`PMCID:7793608\` | Either prefix accepted |
| ISBN | \`9780192854087\` | Hyphens accepted (\`978-0-19-285408-7\`); 10 or 13 digit |
| arXiv ID | \`2301.08745\` or \`arXiv:2301.08745\` | Old-style (\`hep-ph/0501023\`) also accepted |
| ISSN / eISSN | \`2767-9764\` | For journal-level resolution |
| NASA ADS bibcode | \`2021ApJ...920..132C\` | 19-character ADS bibcode |
| WHO IRIS URL | \`https://iris.who.int/handle/10665/...\` | Long-tail identifier most other citation tools miss |

## Pass identifiers verbatim

The server tolerates URL wrappers, prefixes, and hyphens. Do not strip them
before calling the tools — pass exactly what the user provided. Mixed batches
of different identifier types in a single call are supported.
`;

const STYLES_TEXT = `# Supported Citation Styles

Scholar Sidekick MCP supports **10,000+ citation styles**. Pass the style ID
as the \`style\` parameter to \`formatCitation\` (or to \`exportCitation\` with
\`format: "txt"\`).

## Hand-tuned builtin styles

Five styles are implemented natively in TypeScript for maximum stability:

| ID | Style |
| --- | --- |
| \`vancouver\` | Vancouver (default) |
| \`ama\` | AMA |
| \`apa\` | APA (7th edition) |
| \`ieee\` | IEEE |
| \`cse\` | CSE |

The metadata block reports \`formatter: "builtin"\` for these.

## Common CSL style IDs

For everything else, pass any of 10,000+ style IDs from
[citation-style-language/styles](https://github.com/citation-style-language/styles).
Common ones:

| ID | Style |
| --- | --- |
| \`chicago-author-date\` | Chicago (author-date variant) |
| \`chicago-note-bibliography\` | Chicago (notes variant) |
| \`harvard-cite-them-right\` | Harvard |
| \`modern-language-association\` | MLA |
| \`turabian-fullnote-bibliography\` | Turabian (full-note) |
| \`nature\` | Nature |
| \`bmj\` | BMJ |
| \`the-lancet\` | The Lancet |
| \`cell\` | Cell |
| \`science\` | Science |
| \`american-chemical-society\` | ACS |
| \`council-of-science-editors-author-date\` | CSE (author-date) |

The metadata block reports \`formatter: "csl"\` for these. The \`styleUsed\`
field shows the canonical style ID after alias and dependent-style resolution
(asking for \`harvard\` resolves to \`harvard-cite-them-right\`).

## Disambiguation

Both Harvard and Chicago have multiple variants. When the user names "Harvard"
or "Chicago" without a variant, ask which one — the wrong choice produces a
citation that looks subtly wrong to an experienced reader.
`;

const FORMATS_TEXT = `# Supported Export Formats

The \`exportCitation\` tool's \`format\` parameter accepts the following values.
The output is a single string — the entire bibliography in the requested
format, ready to save to disk or paste into the target tool.

| \`format\` value | Output | Common targets |
| --- | --- | --- |
| \`bib\` | BibTeX (\`.bib\`) | LaTeX, BibTeX-aware tools |
| \`ris\` | RIS (\`.ris\`) | EndNote, Mendeley, Zotero, RefWorks |
| \`csl\` | CSL JSON (\`.json\`) | Pandoc, Quarto, citeproc-js consumers |
| \`endnote-xml\` | EndNote XML | EndNote (XML import) |
| \`endnote-refer\` | EndNote Refer / tagged | EndNote (Refer/tagged import) |
| \`refworks\` | RefWorks tagged | RefWorks |
| \`medline\` | MEDLINE / NBIB (\`.nbib\`) | PubMed import, clinical workflows |
| \`zotero-rdf\` | Zotero RDF | Zotero (RDF import) |
| \`csv\` | Spreadsheet-friendly CSV | Excel, Google Sheets, ad-hoc inspection |
| \`txt\` | Plain-text bibliography | Pair with the \`style\` parameter to render in a specific citation style |

## Picking a format

- **LaTeX users** → \`bib\`
- **General reference-manager interchange** → \`ris\` (most widely supported)
- **Tools that consume CSL JSON natively** (Pandoc, Quarto) → \`csl\`
- **Clinical workflows that round-trip through PubMed** → \`medline\`
- **Spreadsheet inspection or filtering** → \`csv\`
- **Rendered text bibliography in a specific style** → \`txt\` plus \`style: "vancouver"\` (or any other style ID)

## Combine with style for txt output

\`txt\` is the only format that uses the \`style\` parameter. The other formats
have their own structured shape and ignore \`style\`.
`;

export function registerResources(server: McpServer): void {
  server.registerResource(
    "supported-identifiers",
    "scholar-sidekick://identifiers",
    {
      title: "Supported Identifier Types",
      description:
        "Reference table of the 8 scholarly identifier types Scholar Sidekick MCP can resolve, with example formats and notes on prefix tolerance.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: IDENTIFIERS_TEXT,
        },
      ],
    }),
  );

  server.registerResource(
    "supported-styles",
    "scholar-sidekick://styles",
    {
      title: "Supported Citation Styles",
      description:
        "Reference table of citation styles supported by formatCitation: 5 hand-tuned builtins plus a starter list of common CSL style IDs from the citation-style-language/styles repository (10,000+ available).",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: STYLES_TEXT,
        },
      ],
    }),
  );

  server.registerResource(
    "supported-formats",
    "scholar-sidekick://formats",
    {
      title: "Supported Export Formats",
      description:
        "Reference table of the 10 export formats supported by exportCitation, with picking guidance per common workflow (LaTeX, reference managers, Pandoc, clinical/PubMed, spreadsheets, plain text).",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: FORMATS_TEXT,
        },
      ],
    }),
  );
}
