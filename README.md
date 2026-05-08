# Scholar Sidekick MCP Server

[MCP](https://modelcontextprotocol.io) server for [Scholar Sidekick](https://scholar-sidekick.com) — resolve any scholarly identifier (DOI, PMID, PMCID, ISBN, arXiv, ISSN, NASA ADS bibcode, WHO IRIS URL) into 10,000+ CSL styles or nine export formats, single or batch, from any AI assistant.

## Highlights

- **Eight identifier types out of the box** — DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, ISSNs, NASA ADS bibcodes, and WHO IRIS URLs (rare in citation tooling).
- **Batch-friendly** — every tool accepts a single identifier or a comma- or newline-separated list; the server normalises the list and resolves them in one round trip.
- **10,000+ citation styles** — five hand-tuned builtins (Vancouver, AMA, APA, IEEE, CSE) plus any [CSL style ID](https://github.com/citation-style-language/styles), with alias and dependent-style resolution.
- **Nine export formats** — BibTeX, RIS, CSL JSON, EndNote (XML/Refer), RefWorks, MEDLINE, Zotero RDF, CSV, plain text.
- **Composable workflow** — chain `resolveIdentifier` → `formatCitation` → `exportCitation` in one prompt for an end-to-end "raw IDs → exportable bibliography" pipeline.
- **Provenance metadata on every response** — formatted output is followed by a metadata block (`requestId`, `formatter`, `styleUsed`, `warnings`) so the assistant can show users *which* engine produced each citation.
- **REST API twin** — the same RapidAPI key works against the [Scholar Sidekick REST API](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick) for non-MCP integrations.

## Tools

| Tool | Description |
| --- | --- |
| **resolveIdentifier** | Resolve DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, ISSNs, ADS bibcodes, and WHO IRIS URLs to structured bibliographic metadata (CSL JSON). Accepts a single identifier or a comma/newline-separated batch. |
| **formatCitation** | Format one or many identifiers into Vancouver, AMA, APA, IEEE, CSE, or any of 10,000+ CSL styles. Output as text, HTML, or JSON. Returns formatted citations plus a provenance metadata block. |
| **exportCitation** | Export one or many identifiers to BibTeX, RIS, CSL JSON, EndNote (XML/Refer), RefWorks, MEDLINE, Zotero RDF, CSV, or plain text — ready to write to disk or hand to a reference manager. |

## Setup

### Get a RapidAPI key

1. Subscribe to [Scholar Sidekick on RapidAPI](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick) (free tier available)
2. Copy your RapidAPI key

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "command": "npx",
      "args": ["-y", "scholar-sidekick-mcp@latest"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add scholar-sidekick \
  -e RAPIDAPI_KEY=your-rapidapi-key \
  -- npx -y scholar-sidekick-mcp@latest
```

### Cursor / VS Code / Windsurf

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "command": "npx",
      "args": ["-y", "scholar-sidekick-mcp@latest"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `RAPIDAPI_KEY` | Yes | Your RapidAPI subscription key |
| `RAPIDAPI_HOST` | No | RapidAPI host (defaults to `scholar-sidekick.p.rapidapi.com`) |
| `SCHOLAR_SIDEKICK_TIMEOUT_MS` | No | Request timeout in milliseconds (default: 30000) |

## Supported Citation Styles

Scholar Sidekick supports **10,000+ CSL styles**, including all major formats used in academic publishing:

| Style | Keyword |
| --- | --- |
| Vancouver | `vancouver` |
| APA (7th ed.) | `apa` |
| AMA | `ama` |
| IEEE | `ieee` |
| CSE | `cse` |
| Chicago (author-date) | `chicago-author-date` |
| Harvard | `harvard-cite-them-right` |
| MLA | `modern-language-association` |
| Turabian | `turabian-fullnote-bibliography` |
| Nature | `nature` |
| BMJ | `bmj` |
| Lancet | `the-lancet` |

Any [CSL style ID](https://github.com/citation-style-language/styles) can be passed as the `style` parameter.

## Example Usage

Once connected, ask your AI assistant:

**Single identifier**

- "Format 10.1056/NEJMoa2033700 in Vancouver style"
- "Resolve PMID:30049270 and export as BibTeX"
- "Give me a Chicago citation for arXiv:2301.08745"

**Batch input** (comma- or newline-separated — every tool handles it)

- "Format these as APA: 10.1056/NEJMoa2033700, PMID:30049270, ISBN:9780192854087"
- "Resolve all of these and tell me which are journal articles vs books: 10.1056/NEJMoa2033700, ISBN:9780192854087, PMC7793608"

**End-to-end workflow** (the assistant chains `resolveIdentifier` → `formatCitation` → `exportCitation` in one prompt)

- "Resolve these three identifiers, format each in AMA, and export the set as BibTeX: 10.1056/NEJMoa2033700, PMID:30049270, ISBN:9780192854087"
- "Build me a Nature-style bibliography from this list and give me a `.bib` file at the end: PMID:30049270, arXiv:2301.08745, 10.1038/s41586-021-03819-2"

## Supported Identifiers

- DOIs (e.g. `10.1056/NEJMoa2033700`)
- PubMed IDs (e.g. `PMID:30049270`)
- PubMed Central IDs (e.g. `PMC7793608`)
- ISBNs (e.g. `ISBN:9780192854087`)
- arXiv IDs (e.g. `2301.08745`)
- ISSNs and eISSNs
- NASA ADS bibcodes
- WHO IRIS URLs

## Provenance & Determinism

Every `formatCitation` and `exportCitation` response is followed by a metadata block so the assistant — and the user — can see exactly which engine produced each citation:

- `formatter` — `builtin` (one of Vancouver, AMA, APA, IEEE, CSE — hand-tuned in TypeScript) or `csl` (citeproc-js with a CSL stylesheet).
- `styleUsed` — the canonical style ID after alias and dependent-style resolution (e.g. asking for `harvard` resolves to `harvard-cite-them-right`).
- `requestId` — for support, reproducibility, and log correlation.
- `warnings` — populated when a fallback was used or the requested style was a dependent of another.

Identifier resolution is deterministic given the same inputs and pinned upstream metadata. Repeated identical requests are cache-hit on the underlying REST API and surface that via the `x-scholar-cache` header.

## REST API

For programmatic access outside of MCP clients, Scholar Sidekick is also available as a REST API on [RapidAPI](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick). Your same RapidAPI key works for both.

## Development

```bash
npm install
npm run build    # Bundle to dist/mcp-server.mjs
npm test         # Run tests
npm run typecheck
```

## License

MIT
