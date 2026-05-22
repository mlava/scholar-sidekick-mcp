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

const VERDICTS_TEXT = `# Citation Verifier Verdicts

The \`verifyCitation\` tool returns one of four verdicts plus a confidence
score. Verdict semantics — what each one means, what it tells the user, and
what to do next — are described here for LLM context at decision time.

## Verdict reference

| Verdict | Meaning | What it tells the user | What to do |
| --- | --- | --- | --- |
| \`matched\` | Claimed title matches the resolved record at the identifier. | The citation is consistent. | Trust the citation; proceed. Surface confidence (\`high\` / \`medium\` / \`low\`) so the user can decide whether to read the paper themselves. |
| \`mismatch\` | Identifier resolves, but the claimed title does NOT correspond to the resolved paper. **This is the dominant AI-citation-fabrication pattern documented by Topaz et al. (Lancet 2026).** | The citation is almost certainly fabricated — the DOI is real but the paper at that DOI is something else entirely. | Flag the citation. Surface the resolved title (in the \`matched\` field of the response) so the user can see what the identifier actually points to. Recommend the user replace or remove the citation. |
| \`ambiguous\` | Identifier resolves to one paper, but the claimed title matches a DIFFERENT paper found via title-search. CITADEL calls this "citation error" (Topaz et al. Supplementary Appendix 2). | The citation has the wrong identifier, but the work it describes does exist. Likely a copy-paste mistake or LLM mixing two real papers. | Show both records: what the cited identifier resolves to (\`matched\`) and what the title-search found (\`candidates[0]\`). Recommend the user correct the identifier to point at the right paper. |
| \`not_found\` | Neither the identifier nor the title resolves anywhere. | The identifier is invalid or unknown, and no real paper with that title was found. Plausibly fully invented. | Flag the citation as unverifiable. Recommend the user check the source of the citation — fully invented citations are rare relative to mismatch / ambiguous, but they do happen with LLM-generated bibliographies. |

## Confidence scores

| Confidence | When used |
| --- | --- |
| \`high\` | Strong signal: titles are very similar or very different; identifiers resolve cleanly. |
| \`medium\` | Mostly clean but with a small mitigation (e.g. 1-year publication-date gap, slight author-name normalisation). |
| \`low\` | Borderline: title similarity falls in the 0.7–0.92 range — same paper described informally or paraphrased? Without \`screenWithLlm: true\` the verifier returns the conservative answer; with the LLM screen enabled (paid plans / authenticated first-party only) the verdict can be upgraded. |

## When to use the LLM screen

Pass \`screenWithLlm: true\` when the user explicitly cares about
distinguishing *fabrication* from *informal-abbreviation paraphrase*. Topaz
et al. document this gap on page 1780: a citation like "Depression and
anxiety in young adults with ID" is the same paper as the canonical
"Depression and anxiety symptoms during the transition to early adulthood
for people with intellectual disabilities," but simple title similarity puts
it in the \`mismatch / low\` bucket. The screen reclassifies these as
\`matched / low\` when the LLM judges them to be the same paper.

The screen is gated to **paid plans and authenticated first-party callers**.
Anonymous and RapidAPI-free callers receive a 400 LLM_SCREEN_FORBIDDEN
error envelope. The non-LLM verdict path is anonymous-tier accessible.

## Provenance

Every response carries a \`_provenance\` block:

| Field | Meaning |
| --- | --- |
| \`stages_run\` | Subset of \`["compare", "search", "llm_screen"]\` — which stages of the verifier actually executed. |
| \`resolved_via\` | The resolver service that returned the matched record (e.g. \`"crossref"\`, \`"pubmed"\`, \`"crossref-search"\`). |
| \`registries_searched\` | Per-registry status block, present only when title-search ran. Each entry: \`{registry: "crossref"\\|"pubmed"\\|"openalex", ok, count, reason?}\`. |
| \`llm_screen\` | Present only when \`screenWithLlm: true\` was requested. Carries \`applied: true\` plus the LLM's verdict / reasoning / cost, or \`applied: false\` plus a reason code (\`verdict_not_eligible\` / \`daily_budget_exceeded\` / \`no_gateway\` / \`upstream_error\` / \`malformed_response\`). |

Surface the provenance to the user when they ask "how did you decide?" or
when they want to reproduce the result.

## Reference

Topaz M, Roguin N, Gupta P, Zhang Z, Peltonen L-M. *Fabricated citations:
an audit across 2·5 million biomedical papers.* The Lancet. 2026;
407(10541):1779-1781. doi:10.1016/S0140-6736(26)00603-3 (open access).
Long-form explainer: https://scholar-sidekick.com/citation-integrity.
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

  server.registerResource(
    "verify-verdicts",
    "scholar-sidekick://verify-verdicts",
    {
      title: "Citation Verifier Verdicts",
      description:
        "Reference for the four verifier verdicts (matched / mismatch / ambiguous / not_found), confidence scores, the LLM-screen gating, the _provenance block, and the Topaz et al. (Lancet 2026) source paper. Use as context when interpreting verifyCitation responses.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: VERDICTS_TEXT,
        },
      ],
    }),
  );
}
